(function () {
	if (!window.astral) astral = {};
	if (!astral.template) astral.template = {};
	if (!astral.template.helpers) astral.template.helpers = {};
	
	astral.template.helpers.push = function (string) {
		return astral.queue.Task.create(function () {
			return string;
		});
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
	astral.template.helpers.delegate = function (delegation) {
		return new DelegationCall(delegation);
	};
	
	var EachIterator = astral.queue.Task.extend({
		constructor: function (listName, itemName, makeTask) {
			this.listName = listName;
			this.itemName = itemName;
			this.makeTask = makeTask;
			
			this.completeCallbacks = [];
		},
		run: function (context) {
			// Create new Queue, that will iterate over list
			var
				list = context.get(this.listName),
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
		}
	});
	astral.template.helpers.each = function (listName, itemName, makeCallback) {
		return new EachIterator(listName, itemName, makeCallback);
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
		return new Includer(template);
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
				
				subtask.onComplete(function (result, error) { task.complete(result, error); });
				subtask.run();
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
			run: function () {
				var
					task = this,
					attrs = this.attrs;
				
				this.loader(this.extend, function (template) {
					template.createHelper.onComplete(function () {
						attrs['parentClass'] = template.helperClass;
						var newClass = template.helperClass.extend(attrs, {parentClass: template.helperClass});
						task.complete(newClass);
					});
					template.createHelper.run();
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
	astral.template.helpers.registerTemplateHelper = function (template, extend, attrs) {
		return new TemplateHelperRegister(template, extend, attrs);
	};
	
})();
