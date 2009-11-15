(function(){
	if (!window.astral) astral = {};
	if (!astral.template) astral.template = {};
	
	astral.template.Token = Base.extend({
		constructor: function (source) {
			this.source = source;
			this.tagName = null;
			this.useInclusion = false;
			this.subtokens = [];
		},
		setInclusionTokens: function (tokens) {
			this.subtokens = tokens;
		},
		is: function (type) {
			return this instanceof astral.template.Token.get(type);
		},
		ignore: false
	}, {
		registry: {},
		register: function (type, token) {
			this.registry[type] = token;
		},
		get: function (type) {
			if (!this.registry[type]) {
				throw new Error("No token registered for type "+type);
			}
			return this.registry[type];
		},
		create: function (type, source) {
			return new (this.get(type))(source);
		}
	});
	
	with (astral.template) {
		/**
		 * Base token to store raw text.
		 * If source is blank, token ignored.
		 */
		var BaseTextToken = Token.extend({
			constructor: function (source) {
				this.base(source);
				this.ignore = !/\S/.test(source);
			}
		});
		
		var DelegatingToken = Token.extend({
			constructor: function (source) {
				this.base(source);
				this.bits = DelegatingToken.splitSource(source);
				this.tagName = this.bits.shift();
			}
		}, {
			/**
			 * Split source line to subtokens.
			 */
			splitSource: function (source) {
				var result = source.split(/([^\s"]*"(?:[^"\\]*(?:\\.[^"\\]*)*)"\S*|[^\s']*'(?:[^'\\]*(?:\\.[^'\\]*)*)'\S*|\S+)/);
				return $.map(result, function (item) { return /\S/.test(item) ? item : []; });
			}
		});
		
		// Controls-generation tokens
		astral.template.ControlTextToken = BaseTextToken.extend({
			render: function () {
				// TODO: throw an exception
				return this.source;
			}
		});
		
		Token.register('control', DelegatingToken.extend({
				constructor: function (source) {
					this.base(source);
					
					if (this.tagName.substring(0, 3) != 'end') {
						this.useInclusion = Control.get(this.tagName).useInclusion;
					}
				},
				
				render: function () {
					var control = Control.create(this.tagName);
					control.setArguments(this.bits);
					if (this.useInclusion) {
						// Control tokens may include only queue tokens
						var content = ($.map(this.subtokens, function (token) { return token.source; })).join('');
						var lexer = new QueueLexer(content);
						control.setContent(lexer.parse());
					}
					return control.render();
				}
			})
		);
		
		// Queue-generation tokens
		astral.template.QueueTextToken = BaseTextToken.extend({
			render: function () {
				return 'push("'+this.source.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')+'")';
			}
		});
		
		Token.register('comment', Token.extend({
				ignore: true
			})
		);
		
		Token.register('queue', DelegatingToken.extend({
				constructor: function (source) {
					this.base(source);
					
					if (!this.isSpecialTokenName(this.tagName)) {
						this.useInclusion = Block.get(this.tagName).useInclusion;
					}
				},
				
				isSpecialTokenName: function (name) {
					return name.substring(0, 3) == 'end' || name == 'else';
				},
				
				render: function () {
					var block = Block.create(this.tagName);
					block.setArguments(this.bits);
					if (this.useInclusion) {
						block.setInclusionTokens(this.subtokens);
					}
					return block.render();
				}
			})
		);
		
		Token.register('variable', Token.extend({
				render: function () {
					return 'delegate(function(context){with(context.data){return push('+this.source+')}})';
				}
			})
		);
	}
})();
