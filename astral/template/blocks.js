(function(){
	if (!window.astral) astral = {};
	if (!astral.template) astral.template = {};
	
	astral.template.Block = Base.extend({
		constructor: function () {},
		
		setArguments: function (args) {
			this.args = args;
		},
		setInclusionTokens: function (tokens) {
			this.inclusionTokens = tokens;
		}
	}, {
		registry: {},
		register: function (name, block) {
			this.registry[name] = block;
		},
		get: function (name) {
			if (!this.registry[name]) {
				throw new Error("Unknown block: " + name);
			}
			return this.registry[name];
		},
		create: function (name) {
			return new (this.get(name));
		}
	});
	
	with (astral.template) {
		Block.register('each', Block.extend({
				render: function () {
					if (this.args[1] != 'as') {
						throw new Error('"each block usage:\n<@ each list as varName @>\n... code accessing varName ...\n<@ endeach @>"');
					}
					return "each('"+this.args[0]+"', '"+this.args[2]+"', function () {\n" +
						"	return new astral.queue.Queue([\n\t\t" +
						($.map(this.inclusionTokens, function (token) { return token.render().replace(/\n/g, '\n\t\t'); })).join(',\n\t\t') + "\n" +
						"	]);\n" +
						"})";
				}
			}, {
				useInclusion: true
			})
		);
		
		Block.register('include', Block.extend({
				render: function () {
					return 'include('+this.args[0]+')';
				}
			}, {
				useInclusion: false
			})
		);
		
		Block.register('source', Block.extend({
				setInclusionTokens: function (tokens) {
					if (tokens.length > 1) {
						throw new Error("source tag can contain only source javascript code.");
					}
					this.source = tokens[0].source;
				},
				render: function () {
					return "astral.queue.Task.create(function (context) {\n"+
						"	with (context.data) {\n"+
						"		"+this.source+"\n"+
						"	}\n"+
						"})";
				}
			}, {
				useInclusion: true
			})
		);
		
		Block.register('call', Block.extend({
				render: function () {
					if (this.args.length > 1) {
						throw new Error("<@ call @> accepts only method name.");
					}
					return "delegate(function (context) {\n" +
						"	return helper.bind(context)."+this.args[0]+"();\n" +
						"})";
				}
			}, {
				useInclusion: false
			})
		);
		
		Block.register('super', Block.extend({
				render: function () {
					return "super()";
				}
			})
		);
	}
	
})();
