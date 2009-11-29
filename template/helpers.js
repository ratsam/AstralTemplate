(function () {
	if (!window.astral) astral = {};
	if (!astral.template) astral.template = {};
	if (!astral.template.helpers) astral.template.helpers = {};
	
	astral.template.helpers.push = function (string, sourceName, lineno) {
		var task = astral.queue.Task.create(function () {
			return string;
		});
		if (astral.template.DEBUG) {
			task.sourceName = sourceName;
			task.lineno = lineno;
			task.helper = 'push';
		}
		return task;
	};
	
	var DelegationCall = astral.queue.Task.extend({
		run: function (context) {
			var
				task = this,
				subtask = this.process(context);
			
			subtask.onComplete(function (result, error) {task.complete(result, error);});
			subtask.run(context);
		}
	});
	astral.template.helpers.delegate = function (delegation, sourceName, lineno) {
		var task = new DelegationCall(delegation);
		if (astral.template.DEBUG) {
			task.sourceName = sourceName;
			task.lineno = lineno;
			task.helper = 'delegate';
		}
		return task;
	};
	
	var EachIterator = astral.queue.Task.extend({
		constructor: function (listGetter, itemName, makeTask, elseQueue) {
			this.listGetter = listGetter;
			this.itemName = itemName;
			this.makeTask = makeTask;
			this.elseQueue = elseQueue;
			
			this.completeCallbacks = [];
		},
		run: function (context) {
			var list = this.listGetter(context);
			if (!list || !list.length) {
				this.runElse(context);
			} else {
				this.runEach(context, list);
			}
		},
		runEach: function (context, list) {
			// Create new Queue, that will iterate over list
			var
				itemName = this.itemName,
				queue = new astral.queue.Queue(),
				makeTask = this.makeTask;
			
			for (var i=0; i<list.length; i++) {
				queue.addTask(astral.queue.Task.create((function (iterationValue) {
					return function (context) {
						context.set(itemName, iterationValue);
					};
				})(list[i])));
				queue.addTask(makeTask());
			}
			
			var iterator = this;
			queue.onComplete(function (result) { iterator.complete(result); });
			queue.run(context);
		},
		runElse: function (context) {
			if (this.elseQueue) {
				var
					iterator = this,
					task = this.elseQueue.clone();
				
				task.onComplete(function (result) { iterator.complete(result); });
				task.run(context);
			} else {
				this.complete(null);
			}
		}
	});
	astral.template.helpers.each = function (listName, itemName, makeCallback, elseQueue, sourceName, lineno) {
		var task = new EachIterator(listName, itemName, makeCallback, elseQueue);
		if (astral.template.DEBUG) {
			task.sourceName = sourceName;
			task.lineno = lineno;
			task.helper = 'each';
		}
		return task;
	};
	
	var IfStatement = astral.queue.Task.extend({
		constructor: function (checker, trueQueue, falseQueue) {
			this.checker = checker;
			this.trueQueue = trueQueue;
			this.falseQueue = falseQueue;
			this.completeCallbacks = [];
		},
		run: function (context) {
			var
				check = false,
				task = this;
			
			try {
				check = this.checker(context);
			} catch (e) {}
			
			var queue = check ? this.trueQueue : this.falseQueue;
			if (!queue) {
				this.complete(null);
			} else {
				queue = queue.clone();
				queue.onComplete(function (result) { task.complete(result); })
				queue.run(context);
			}
		}
	});
	astral.template.helpers.checkIf = function (checker, trueQueue, falseQueue, sourceName, lineno) {
		var task = new IfStatement(checker, trueQueue, falseQueue);
		if (astral.template.DEBUG) {
			task.sourceName = sourceName;
			task.lineno = lineno;
			task.helper = 'if';
		}
		return task;
	};
	
	var Includer = astral.queue.Task.extend({
		constructor: function (template) {
			this.template = template;
			this.completeCallbacks = [];
			this.load = astral.template.Template.getLoader();
		},
		run: function (context) {
			var includer = this;
			this.load(this.template, function (template) {
				template.render(function (result) {includer.complete(result);}, context.data);
			});
		}
	});
	astral.template.helpers.include = function (template) {
		var task = new Includer(template);
		if (astral.template.DEBUG) {
			task.helper = 'include';
		}
		return task;
	};
	
	// Template assigned class-based helper with inheritance support
	
	var BaseTemplateHelper = Base.extend({
		constructor: function () {},
		
		/**
		 * Bind context to self, allows chaining.
		 * 
		 * @param context astral.queue.Context
		 * @return this
		 */
		bind: function (context) {
			this.context = context;
			return this;
		},
		
		createMainQueue: function (template) {
			// Creating main queue.
			// After it created first time, assign it to template to avoid new generations.
			var queue = this._createMainQueue();
			if (template) {
				template.renderQueue = queue.clone();
			}
			return queue;
		}
	});
	
	var TemplateHelperRegister = astral.queue.Task.extend({
		constructor: function (template, extend, attrs) {
			if (!attrs) {
				// Base template
				attrs = extend;
				extend = null;
			}
			this.template = template;
			this.extend = extend;
			this.attrs = attrs;
			
			this.completeCallbacks = [];
		},
		
		run: function (context) {
			if (this.template.helperClass) {
				// Helper already registered
				this.complete(this.template.helperClass);
			} else {
				var
					task = this,
					subtask = this._makeTask();
				
				if (astral.template.DEBUG) subtask.task = task;
				
				subtask.onComplete(function (result, error) { task.complete(result, error); });
				subtask.run(context.push());
			}
		},
		
		/**
		 * Load template, force its helper creation, return extended helper.
		 */
		_helperLoader: astral.queue.Task.extend({
			constructor: function (loader, extend, attrs) {
				this.loader = loader;
				this.extend = extend;
				this.attrs = attrs;
				this.completeCallbacks = [];
			},
			run: function (context) {
				var
					task = this,
					attrs = this.attrs;
				
				this.loader(this.extend, function (template) {
					var helperCreator = template.createHelper(context);
					helperCreator.onComplete(function () {
						attrs['parentClass'] = template.helperClass;
						var newClass = template.helperClass.extend(attrs, {parentClass: template.helperClass});
						task.complete(newClass);
					});
					helperCreator.run(context);
				});
			}
		}),
		
		/**
		 * Create task to present template helper.
		 * 
		 * @return astral.queue.Task
		 */
		_makeTask: function () {
			var attrs = this.attrs;
			
			if (this.extend) {
				return new this._helperLoader(astral.template.Template.getLoader(), this.extend, attrs);
			} else {
				return astral.queue.Task.create(function () {
					return BaseTemplateHelper.extend(attrs);
				});
			}
		},
		
		complete: function (helperClass, error) {
			this.template.helperClass = helperClass;
			this.template.helper = new helperClass();
			this.base(null, error); // do not return helper as a result
		}
	});
	astral.template.helpers.registerTemplateHelper = function (extend, attrs) {
		return function () {
			var task = new TemplateHelperRegister(this, extend, attrs);
			if (astral.template.DEBUG) {
				task.helper = 'registerTemplateHelper';
			}
			return task;
		};
	};
	
})();
