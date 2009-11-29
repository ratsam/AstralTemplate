(function(){
	if (!window.astral) astral = {};
	if (!astral.template) astral.template = {};
	
	astral.template.Block = Base.extend({
		constructor: function () {
			this.useElse = this.constructor.useElse ? true : false;
		},
		
		setArguments: function (args) {
			this.args = args;
		},
		setInclusionTokens: function (tokens) {
			if (!this.useElse) {
				this.inclusionTokens = tokens;
			} else {
				var elseFound = false;
				this.inclusionTokens = [[], []];
				
				for (var i=0; i<tokens.length; i++) {
					var token = tokens[i];
					if (token.tagName == 'else') {
						elseFound = true;
						continue;
					}
					this.inclusionTokens[elseFound?1:0].push(token);
				}
			}
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
				render: function (token) {
					if (this.args[1] != 'as') {
						throw new Error('"each block usage:\n<@ each list as varName @>\n... code accessing varName ...\n<@ endeach @>"');
					}
					
					var groups = $.map(this.inclusionTokens, function (group) {
						var result = $.map(group, function (token) {
							return token.render().replace(/\n/g, '\n\t');
						});
						
						if (!result.length) {
							return 'null';
						} else {
							return 'new astral.queue.Queue([\n\t\t' +
								result.join(',\n').replace(/\n/g, '\n\t\t') + '\n\t' +
								'])';
						}
					});
					
					var clause = "function (context) { with (context.data) { return "+this.args[0]+"; } }";
					
					return "each("+clause+", '"+this.args[2]+"',\n\t" +
								"function () {\n\t\t" +
									"return " + groups[0].replace(/\n/g, '\n\t') + ";\n\t" +
								"},\n\t" +
								groups[1] + "\n" +
							")";
				}
			}, {
				useInclusion: true,
				useElse: true
			})
		);
		
		Block.register('if', Block.extend({
				render: function () {
					var groups = $.map(this.inclusionTokens, function (group) {
						var result = $.map(group, function (token) {
							return token.render().replace(/\n/g, '\n\t');
						});
						
						if (!result.length) {
							return 'null';
						} else {
							return 'new astral.queue.Queue([\n\t\t' +
								result.join(',\n').replace(/\n/g, '\n\t\t') + '\n\t' +
								'])';
						}
					});
					
					
					return 'checkIf(\n' +
							'	function (context) {\n' +
							'		with (context.data) {\n' +
							'			return ' + this.args.join(' ') +';\n' +
							'		}\n' +
							'	},\n\t' +
							groups.join(',\n\t') +'\n' +
							')';
				}
			}, {
				useInclusion: true,
				useElse: true
			})
		);
		
		Block.register('else', Block.extend({
			render: function () {
				throw new Error("'else' block not allowed here");
			}
		}));
		
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
