(function(){
	if (!window.astral) astral = {};
	if (!astral.queue) astral.queue = {};
	
	astral.queue.Context = function (data, parent) {
		this.data = data;
		this.parent = parent;
	};
	
	astral.queue.Context.prototype = {
		/**
		 * Return new Context with cloned data
		 * 
		 * @return astral.queue.Context
		 */
		push: function () {
			return new astral.queue.Context(astral.queue.clone(this.data), this);
		},
		
		/**
		 * Return parent context
		 * 
		 * @return astral.template.Context
		 */
		pull: function () {
			return this.parent ? this.parent : new astral.queue.Context({});
		},
		
		/**
		 * Set variable to current context
		 * 
		 * @param name String
		 * @param value String
		 */
		set: function (name, value) {
			this.data[name] = value;
		},
		
		/**
		 * Return value for name.
		 * If name not registered, return empty string.
		 * 
		 * @param name String
		 * @return mixed
		 */
		get: function (name) {
			return this.data[name] || '';
		}
	};
})();
