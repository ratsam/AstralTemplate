(function (){
	if (!window.astral) astral = {};
	if (!astral.template) astral.template = {};
	
	with (astral.template) {
		/**
		 * Restructurize tokens list into tree
		 * 
		 * @param tokensList astral.template.Token[]
		 * @param getUntil String | null
		 * @return astral.template.Token[]
		 */
		var treeTokens = function (tokensList, getUntil) {
			var tokensTree = [];
			while (tokensList.length) {
				var token = tokensList.shift();
				if (getUntil && token.tagName == getUntil) {
					return tokensTree;
				}
				if (token.useInclusion) {
					token.setInclusionTokens(treeTokens(tokensList, 'end'+token.tagName));
				}
				if (!token.ignore) {
					tokensTree.push(token);
				}
			}
			if (getUntil) {
				throw new Error("Unmatched close block: "+getUntil);
			}
			return tokensTree;
		};
		
		var BaseLexer = Base.extend({
			constructor: function (templateString) {
				this.templateString = templateString;
				this.textTokenClass = this.constructor.textTokenClass;
				
				this._sortTags();
				this._initRe();
			},
			/**
			 * Sort tags to match longest first
			 */
			_sortTags: function () {
				var class = this.constructor;
				if (class._tagsSorted) {
					this.tags = class.tags;
					return;
				}
				
				// create list from hash
				var tagsList = []
				for (var name in class.tags) {
					tagsList.push({'name': name, 'tags': class.tags[name]});
				}
				// sort
				tagsList = tagsList.sort(function (a, b) {
					if (a.tags[0].length > b.tags[0].length) return -1;
					if (a.tags[0].length < b.tags[0].length) return 1;
					return 0;
				})
				
				// make new hash
				var tagsHash = {};
				while (tagsList.length) with (tagsList.shift()) tagsHash[name] = tags;
				
				// Assign to class and call method again
				class.tags = tagsHash;
				class._tagsSorted = true;
				this._sortTags();
			},
			/**
			 * Init regExp to split source template into tokens.
			 */
			_initRe: function () {
				var escape = function (string) {
					return string.replace(/([.*+?|()\[\]{}\\])/g, '\\$1');
				}
				var bits = [];
				for (var tag in this.tags) {
					bits.push(escape(this.tags[tag][0])+'.*?'+escape(this.tags[tag][1]));
				}
				
				this.tagRe = new RegExp('('+bits.join('|') +')');
			},
			
			/**
			 * Return tokens tree
			 * 
			 * @return astral.template.Token[]
			 */
			getTokens: function () {
				return treeTokens(this.listTokens());
			},
			
			/**
			 * Return plain tokens list.
			 * 
			 * @return astral.template.Token[]
			 */
			listTokens: function () {
				var
					insideTag = false,
					result = [];
				
				var tokenStrings = this.templateString.split(this.tagRe);
				
				for (var i=0; i<tokenStrings.length; i++) {
					if (tokenStrings[i]) {
						result.push(this.createToken(tokenStrings[i], insideTag));
					}
					insideTag = !insideTag;
				}
				return result;
			},
			/**
			 * Create token fro source.
			 * 
			 * @param tokenString String
			 * @param insideTag Boolean
			 * @return astral.template.Token
			 */
			createToken: function (tokenString, insideTag) {
				if (insideTag) {
					for (var tag in this.tags) {
						var tagStart = this.tags[tag][0];
						if (tokenString.substring(0, tagStart.length) == tagStart) {
							var cut = tokenString.length - this.tags[tag][1].length;
							return Token.create(tag, $.trim(tokenString.substring(tagStart.length, cut)));
						}
					}
					throw new Error("Unable to parse token: "+tokenString);
				} else {
					return new (this.textTokenClass)(tokenString);
				}
			}
		}, {
			_tagsSorted: false
		});
		
		//
		
		/**
		 * First lexer to prepare and parse helper tokens.
		 */
		astral.template.HelperLexer = BaseLexer.extend({
			constructor: function (templateString) {
				this.base(templateString);
				this.base = true; // Template can be either base (with createMainQueue method) or extention, where TextTokens causes error.
			},
			parse: function () {
				var tokens = this.getTokens();
				// FIXME: BADCODE
				if (tokens[0].tagName == 'extends') {
					return this.processExtentionTemplate(tokens.shift(), tokens);
				} else {
					return this.processBaseTemplate(tokens);
				}
				// TODO: test there is no control tokens inside other tokens
			},
			processExtentionTemplate: function (extendsToken, tokens) {
				$.each(tokens, function (_, token) {
					if (!token.is('control')) {
						if (astral.template.DEBUG) console.debug(token);
						throw new Error("Extention template MUST NOT contain own non-control tokens");
					}
				})
				
				this.base = false;
				var extend = extendsToken.bits[0];
				
				if (!(extend[0] == '"' || extend[0] == "'")) { // FIXME: BADCODE
					extend = 'function (context) { return context.get("'+extend+'"); }';
				}
				
				return 'registerTemplateHelper(currentTemplate, '+extend+', {\n\t'+
					this._renderTokens(tokens) + '\n' +
					'})';
			},
			processBaseTemplate: function (tokens) {
				var mainQueue = tokens.pop();
				if (mainQueue.is('control')) {
					throw new Error("Base template MUST define non-control tokens");
				}
				var def = Token.create('control', 'def _createMainQueue');
				def.setInclusionTokens([mainQueue]);
				tokens.push(def);
				
				return 'registerTemplateHelper(currentTemplate, {\n\t' +
					this._renderTokens(tokens) + '\n' +
					'})';
			},
			_renderTokens: function (tokens) {
				return ($.map(tokens, function (token) { return token.render(); })).join(',\n').replace(/\n/g, '\n\t');
			}
		}, {
			tags: {
				control: ['<?', '?>']
			},
			textTokenClass: astral.template.ControlTextToken
		});
		
		/**
		 * Queue lexer. Parse template into helpers queue.
		 */
		astral.template.QueueLexer = BaseLexer.extend({
			parse: function () {
				return ($.map(this.getTokens(), function(token){return token.render();})).join(',\n');
			}
		}, {
			tags: {
				queue: ['<@', '@>'],
				variable: ['<%=', '%>'],
				comment: ['<#', '#>']
			},
			textTokenClass: astral.template.QueueTextToken
		});
	}
})();
