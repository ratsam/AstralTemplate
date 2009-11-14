(function(){
	if (!window.astral) astral = {};
	if (!astral.template) astral.template = {};
	
	/**
	 * Return flatten array.
	 * Example input: [1, [2, 3, [4], 5], [6, 7]]
	 * Example output: [1 ,2 ,3 ,4 ,5 ,6 ,7]
	 */
	var flatten = function (list, filter) {
		var result = [];
		for (var i=0; i<list.length; i++) {
			if (typeof(list[i]) == "undefined" && filter) continue;
			
			result = result.concat(list[i] && list[i].constructor == Array ? flatten(list[i], filter) : [list[i]]);
		}
		return result;
	};
	
	astral.template.Template = Base.extend({
		constructor: function (renderQueue) {
			this.renderQueue = renderQueue;
		},
		
		getHelper: function (context) {
			return this.helper.bind(context);
		},
		
		/**
		 * Render template using queue.
		 * @target may be either callback or jQuery selector
		 */
		render: function (target, data) {
			var queue = this.renderQueue.clone();
			queue.onComplete(this.makeCallback(target));
			queue.run(new astral.queue.Context(data||{}));
		},
		
		makeCallback: function (target) {
			if (typeof(target) == 'string') {
				return function (result) {
					$(target).html(flatten(result).join(''));
				};
			} else return function (result) { target(flatten(result).join('')); };
		}
	}, {
		/**
		 * Create astral.template.Template instance from source template.
		 * 
		 * @param templateCode String
		 * @return astral.template.Template
		 */
		fromSource: function (templateCode) {
			var lexer = new astral.template.HelperLexer(templateCode);
			var code = lexer.parse();
			
			var compileCode = 'with (astral.template.helpers) {\n' +
						'	currentTemplate.createHelper = ' + code.replace(/\n/g, '\n\t') + ';\n' +
						'	currentTemplate.renderQueue = new astral.queue.Queue([\n'+
						'		currentTemplate.createHelper,\n' +
						'		delegate(function (context) {\n' +
						'			return currentTemplate.getHelper(context).createMainQueue(currentTemplate);\n' +
						'		})\n' +
						'	]);\n' +
						'}';
			if (astral.template.DEBUG) {
				console.log('Creating new template:');
				console.log(compileCode);
			}
			var template = new this;
			(new Function('currentTemplate', compileCode))(template);
			return template;
		},
		
		/**
		 * Register templates loader.
		 * Loader must take templateName and callback arguments.
		 * 
		 * @param loader callbable
		 */
		registerLoader: function (loader) {
			this.loader = loader;
		},
		/**
		 * Return registered loader.
		 * 
		 * @throws Error if no loader registered
		 * @return callable
		 */
		getLoader: function () {
			if (!this.loader) {
				throw new Error("No template loader registered");
			}
			return this.loader;
		},
		load: function (name, callback) {
			this.getLoader()(name, callback);
		}
	});
})();
