(function () {
	if (!window.astral) astral = {};
	if (!astral.template) astral.template = {};
	
	astral.template.Control = Base.extend({
		constructor: function () {},
		
		setArguments: function (args) {
			this.args = args;
		},
		setContent: function (content) {
			this.content = content;
		}
	}, {
		registry: {},
		register: function (name, instanceAttrs, staticAttrs) {
			this.registry[name] = this.extend(instanceAttrs, staticAttrs);
		},
		get: function (name) {
			if (!this.registry[name]) {
				throw new Error("Unknown control: "+name);
			}
			return this.registry[name];
		},
		create: function (name) {
			return new (this.registry[name]);
		}
	});
	
	with (astral.template) {
		Control.register('def', {
			render: function () {
				return this.args[0]+': function () {\n' +
					'	var helper = this;\n' +
					'	var super = (function(method, obj){return function () {return method.apply(obj);}})(helper.base, helper);\n' +
					'	with (this.context.data) {\n'+
					'		return new astral.queue.Queue([\n\t\t\t'+
					this.content.replace(/\n/g, '\n\t\t\t') +'\n' +
					'		]);\n' +
					'	}\n' +
					'}';
			}
		}, {
			useInclusion: true
		});
		
		Control.register('extends', {
			render: function () {
				throw new Error("The <? extends ?> tag MUST be the first tag in template.");
			}
		}, {
			useInclusion: false
		});
	}
	
})();
