(function () {
	if (!window.astral) astral = {};
	if (!astral.queue) astral.queue = {};
	
	/**
	 * @private
	 */
	var sizeOf = function (array) {
		var length = 0;
		for (var k in array) {
			if (array.hasOwnProperty(k)) {
				length++;
			}
		}
		return length;
	};
	
	/**
	 * Deep copy object
	 */
	astral.queue.clone = function (obj, ignore, seenObjects, mappingArray) {
		if(obj == null || typeof(obj) != 'object') {
			return obj;
		}
		
		seenObjects = seenObjects || [];
		mappingArray = mappingArray || [];
		
		var temp = new obj.constructor();
		seenObjects.push(obj);
		mappingArray.push(temp);
		
		for(var key in obj) {
			if (obj.hasOwnProperty(key)) {
				if (ignore && ignore(obj[key], key)) {
					// Just assign property, do not deep copy
					temp[key] = obj[key];
					continue;
				}
				var index = seenObjects.indexOf(obj[key]);
				if (index == -1) {
					temp[key] = astral.queue.clone(obj[key], ignore, seenObjects, mappingArray);
					seenObjects.push(obj[key]);
					mappingArray.push(temp[key]);
				} else {
					temp[key] = mappingArray[index];
				}
			}
		}
		
		return temp;
	};
	
	astral.queue.Task = Base.extend({
		constructor: function (process) {
			this.process = process;
			this.completeCallbacks = [];
		},
		onComplete: function (callback) {
			this.completeCallbacks.push(callback);
		},
		complete: function (result, error) {
			for (var i=0; i<this.completeCallbacks.length; i++) {
				// TODO: run callback as Tasks to ignore errors
				this.completeCallbacks[i](result, error);
			}
		}
	}, {
		create: function (process) {
			return new SyncTask(process);
		}
	});
	
	/**
	 * Queue to process tasks.
	 * Can be used as Task itself.
	 */
	astral.queue.Queue = Base.extend({
		/**
		 * Set initial tasks list.
		 * 
		 * @param tasks astral.queue.Task[] | astral.queue.Queue[]
		 */
		constructor: function (tasks) {
			this.tasks = tasks || [];
			this.results = [];
			this.completeCallbacks = [];
			this.completed = false;
		},
		
		/**
		 * Return new Queue with tasks copied.
		 * 
		 * Known issues:
		 *  - error running subqueue second time
		 */
		clone: function () {
			if (this.completed) {
				throw new Error("Unable to clone completed queue");
			}
			
			// FIXME: BADCODE:
			return astral.queue.clone(this, function (node) {return node instanceof astral.template.Template});
		},
		
		/**
		 * Add task to processing queue.
		 * 
		 * @throws Error if queue completed.
		 * @param task astral.queue.Task | astral.queue.Queue
		 */
		addTask: function (task) {
			if (this.completed) {
				throw new Error("Queue already completed");
			}
			
			this.tasks.push(task);
		},
		
		/**
		 * Add callback.
		 * 
		 * @param callback callable
		 */
		onComplete: function (callback) {
			if (this.completed) {
				this._runCallback(callback);
			} else {
				this.completeCallbacks.push(callback);
			}
		},
		
		/**
		 * Mark Queue as completed, invoke callbacks.
		 */
		complete: function () {
			this.completed = true;
			
			if (!this.completeCallbacks.length) return; // TODO: warning
			for (var i=0; i<this.completeCallbacks.length; i++) {
				this._runCallback(this.completeCallbacks[i], this.results);
			}
		},
		
		/**
		 * Run callback using Task, ignoring processing errors.
		 * 
		 * @param callback callable
		 * @param result mixed
		 */
		_runCallback: function (callback, result) {
			astral.queue.Task.create(function () { callback(result); }).run();
		},
		
		/**
		 * Prepare next task and run it.
		 * Completed task MUST invoke set callback to tell queue run next task.
		 */
		run: function (context) {
			if (this.completed) {
				throw new Error("Unable to run completed queue");
			}
			
			if (!this.tasks.length) {
				// TODO: warning
				this.complete();
				return;
			}
			
			this._processNext(context);
		},
		
		/**
		 * Process next task.
		 * 
		 * @param context astral.queue.Context
		 */
		_processNext: function (context) {
			var task = this.tasks[this.results.length];
			
			if (astral.queue.DEBUG) {
				console.log('Processing next task ('+(this.results.length+1)+'/'+this.tasks.length+'):');
				console.debug(task);
			}
			
			task.onComplete(this._makeTaskCallback(this.results.length, context));
			task.run(context);
		},
		
		/**
		 * Create callback to be processed with next task.
		 * 
		 * @param taskOrder int
		 * @param context astral.queue.Context
		 * @return callable
		 */
		_makeTaskCallback: function (taskOrder, context) {
			var queue = this;
			
			return function (result, error) {
				if (error && astral.queue.DEBUG) console.error(error);
				
				queue.results.push(result);
				if (queue.results.length == queue.tasks.length) {
					// All tasks processed
					queue.complete();
				} else {
					queue._processNext(context);
				}
			};
		}
	});
	
	/**
	 * Task to run regular functions.
	 * Uses setTimeout mechanusm to emulate threads.
	 */
	var SyncTask = astral.queue.Task.extend({
		run: function (context) {
			var task = this;
			
			setTimeout(function () { task._run(context); }, 0);
		},
		
		_run: function (context) {
			try {
				var result = this.process(context);
			} catch (e) {
				if (astral.queue.DEBUG) console.debug('Got error while running task', e);
				this.complete('', e);
				return;
			}
			this.complete(result);
		}
	});
})();
