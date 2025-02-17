(function(){
	"use strict";

	var touchEnabled = "ontouchstart" in document.documentElement;
	var pressEvent   = touchEnabled ? "touchend" : "click";
	var each         = [].forEach;


	// Name of the onTransitionEnd event supported by this browser
	var transitionEnd = (function(){
		for(var names = "transitionend webkitTransitionEnd oTransitionEnd otransitionend".split(" "), i = 0; i < 4; ++i)
			if("on"+names[i].toLowerCase() in window) return names[i];
		return names[0];
	}());
	
	
	
	/**
	 * Conditionally add or remove a token from a token-list.
	 *
	 * @param {DOMTokenList} list
	 * @param {String} token
	 * @param {Boolean} enabled
	 */
	function setToken(list, token, enabled){
		enabled ? list.add(token) : list.remove(token);
	}



	/**
	 * Stop a function from firing too quickly.
	 *
	 * Returns a copy of the original function that runs only after the designated
	 * number of milliseconds have elapsed. Useful for throttling onResize handlers.
	 *
	 * @param {Number} limit - Threshold to stall execution by, in milliseconds.
	 * @param {Boolean} soon - If TRUE, will call the function *before* the threshold's elapsed, rather than after.
	 * @return {Function}
	 */
	function debounce(fn, limit, soon){
		var limit = limit < 0 ? 0 : limit,
			started, context, args, timer,

			delayed = function(){

				// Get the time between now and when the function was first fired
				var timeSince = Date.now() - started;

				if(timeSince >= limit){
					if(!soon) fn.apply(context, args);
					if(timer) clearTimeout(timer);
					timer = context = args = null;
				}

				else timer = setTimeout(delayed, limit - timeSince);
			};


		// Debounced copy of the original function
		return function(){
			context = this,
			args    = arguments;

			if(!limit)
				return fn.apply(context, args);

			started = Date.now();
			if(!timer){
				if(soon) fn.apply(context, args);
				timer = setTimeout(delayed, limit);
			}
		};
	};



	var uniqueID = (function(){
		var IDs     = {};
		var indexes = {};
		
		
		/**
		 * Generate a unique ID for a DOM element.
		 *
		 * By default, minimalist IDs like "_1" or "_2" are generated using internally
		 * tracked incrementation. Uglier, more collision-proof IDs can be generated by
		 * passing a truthy value to the function's first argument.
		 *
		 * Irrespective of whether values are being generated simply or randomly, the
		 * document tree is always consulted first to ensure a duplicate ID is never
		 * returned.
		 *
		 * @param {String}  prefix - Prefix prepended to result. Default: "_"
		 * @param {Boolean} random - Generate collision-proof IDs using random symbols
		 * @param {Number}  length - Length of random passwords. Default: 6
		 * @return {String}
		 */
		function uniqueID(prefix, complex, length){
			length     = +(length || 6);
			var result =  (prefix = prefix || "_");
			
			// Simple IDs
			if(!complex){
				
				// Set this prefix's starting index if it's not been used yet
				if(!indexes[prefix])
					indexes[prefix] = 0;
				
				result += ++indexes[prefix];
			}
			
			// Uglier/safer IDs
			else{
				var chars   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
				chars      += chars.toLowerCase();
				result     += chars[ Math.round(Math.random() * (chars.length - 1)) ];
				chars      += "0123456789";
				
				while(result.length < length)
					result += chars[ Math.round(Math.random() * (chars.length - 1))];
			}
			
			return IDs[result] || document.getElementById(result)
				? uniqueID(prefix, complex)
				: (IDs[result] = true, result);
		}
		
		
		return uniqueID;
	}());


	// Name of the CSSOM property used by this browser for CSS transforms
	var cssTransform = (function(n){
		s = document.documentElement.style;
		if((prop = n.toLowerCase()) in s) return prop;
		for(var prop, s, p = "Webkit Moz Ms O Khtml", p = (p.toLowerCase() + p).split(" "), i = 0; i < 10; ++i)
			if((prop = p[i]+n) in s) return prop;
		return "";
	}("Transform"));


	// Whether 3D transforms are supported by this browser
	var css3DSupported = (function(propName){
		var e = document.createElement("div"), s = e.style,
		v = [["translateY(", ")"], ["translate3d(0,", ",0)"]]
		try{ s[propName] = v[1].join("1px"); } catch(e){}
		return v[+!!s[propName]] === v[1];
	}(cssTransform));









	var folds = [];


	/**
	 * Represents a single panel of togglable content inside an Accordion.
	 *
	 * @param {Accordion} accordion
	 * @param {HTMLElement} el
	 * @constructor
	 */
	var Fold = function(accordion, el){
		var THIS            = this;
		var heading         = el.firstElementChild;
		var content         = el.lastElementChild;
		var elClasses       = el.classList;
		var openClass       = accordion.openClass;
		var closeClass      = accordion.closeClass;
		var keysEnabled     = !accordion.noKeys;
		var useBorders      = accordion.useBorders;
		var useTransforms   = !accordion.noTransforms && cssTransform;
		var onToggle        = accordion.onToggle;
		var _disabled       = false;
		var _open, _y, _height, _ariaEnabled;
		var scrollX, scrollY;
		var onTouchStart;
		var onKeyDown;
		var onPress;
		
		
		Object.defineProperties(THIS, {
			fit: {value: fit},
			
			
			// Add or remove relevant ARIA attributes from the fold's elements
			ariaEnabled: {
				get: function(){ return _ariaEnabled; },
				set: function(input){
					if((input = !!input) !== !!_ariaEnabled){
						_ariaEnabled = input;
						
						// Enable ARIA-attribute management
						if(input){
							heading.setAttribute("role", "tab");
							content.setAttribute("role", "tabpanel");
							checkIDs();
							
							// Update the attributes that're controlled by .open's setter
							heading.setAttribute("aria-selected", !!_open);
							heading.setAttribute("aria-expanded", !!_open);
							content.setAttribute("aria-hidden",   !_open);
						}
						
						// Disabling; remove all relevant attributes
						else{
							heading.removeAttribute("role");
							heading.removeAttribute("aria-controls");
							heading.removeAttribute("aria-selected");
							heading.removeAttribute("aria-expanded");
							
							content.removeAttribute("role");
							content.removeAttribute("aria-labelledby");
							content.removeAttribute("aria-hidden");
						}
					}
				}
			},

			
			
			// Whether or not the fold's currently opened
			open: {
				
				get: function(){
					
					// Derive the fold's opened state from the DOM if it's not been determined yet
					if(undefined === _open){
						_open = elClasses.contains(openClass);
						setToken(elClasses, closeClass, !_open);
					}
					
					return _open;
				},
				
				
				set: function(input){
					if((input = !!input) !== _open){
						
						// If an onToggle callback was specified, run it. Avoid doing anything if it returns false.
						if("function" === typeof onToggle && false === onToggle.call(null, THIS, input))
							return;
						
						setToken(elClasses, openClass,   input);
						setToken(elClasses, closeClass, !input);
						_open = input;
						
						// Update ARIA attributes
						if(_ariaEnabled){
							heading.setAttribute("aria-selected",  input);
							heading.setAttribute("aria-expanded",  input);
							content.setAttribute("aria-hidden",   !input);
						}
						
						// If this fold was closed when the screen resized, run a full update in case its contents were juggled around
						if(THIS.needsRefresh){
							delete THIS.needsRefresh;
							accordion.refresh();
						}
						else accordion.update();
						
						// Close other folds if accordion is modal
						if(accordion.modal && _open){
							for(var fold, i = 0, l = accordion.folds.length; i < l; ++i){
								if(THIS !== (fold = accordion.folds[i]))
									fold.open = false;
							}
						}
					}
				}
			},
			
			
			// Whether the fold's been deactivated
			disabled: {
				get: function(){ return _disabled },
				set: function(input){
					if((input = !!input) !== _disabled){
						var style = el.style;
						
						// Deactivated
						if(_disabled = input){
							style.height = null;
							useTransforms
								? (style[cssTransform] = null)
								: (style.top = null);
							
							touchEnabled && heading.removeEventListener("touchstart", onTouchStart);
							heading.removeEventListener(pressEvent, onPress);
							elClasses.remove(openClass, closeClass);
							if(onKeyDown){
								heading.removeEventListener("keydown", onKeyDown);
								heading.removeAttribute("tabindex");
							}
							
							if(_ariaEnabled){
								THIS.ariaEnabled = false;
								_ariaEnabled     = true;
							}
						}
						
						// Reactivated
						else{
							style.height = _height + "px";
							useTransforms
								? style[cssTransform] =
									css3DSupported
										? ("translate3D(0," + _y + "px,0)")
										: ("translateY("    + _y + "px)")
								: (style.top = _y + "px");
							
							touchEnabled && heading.addEventListener("touchstart", onTouchStart);
							heading.addEventListener(pressEvent, onPress);
							
							if(onKeyDown){
								heading.addEventListener("keydown", onKeyDown);
								heading.tabIndex = 0;
							}
						}
					}
				}
			},
			
			
			// Vertical position of the fold within an accordion's container
			y: {
				get: function(){
					if(undefined === _y)
						return (_y = parseInt(el.style.top) || 0);
					return _y;
				},
				
				set: function(input){
					if((input = +input) !== _y){
						_y = input;
						useTransforms
							? el.style[cssTransform] =
								css3DSupported
									? ("translate3D(0," + input + "px,0)")
									: ("translateY("    + input + "px)")
							: (el.style.top = input + "px");
					}
				}
			},
			
			
			// Height of the fold's outermost container
			height: {
				
				get: function(){
					if(undefined === _height){
						_height = THIS.headingHeight + content.scrollHeight;
						el.style.height = _height + "px";
					}
					return _height;
				},
				
				set: function(input){
					if(input && (input = +input) !== _height){
						el.style.height = input + "px"
						_height         = input;
					}
				}
			},
			

			// Current height of the fold's heading
			headingHeight: {
				get: function(){
					return heading.scrollHeight
						+ THIS.heightOffset
						+ (useBorders ? THIS.headingBorder : 0)
				}
			},
			
			// Total height consumed by the heading element's CSS borders, if any
			headingBorder: {
				get: function(){
					return (heading.offsetHeight || 0) - (heading.clientHeight || 0);
				}
			},
			
			
			
			// Total height of the fold's container element
			elHeight: {
				get: function(){
					return el.scrollHeight + (useBorders ? THIS.elBorder : 0);
				}
			},
			
			// Total height consumed by container element's CSS borders, if any
			elBorder: {
				get: function(){
					return (el.offsetHeight || 0) - (el.clientHeight || 0);
				}
			},
			
			
			// Whether the fold's container has been resized incorrectly
			wrongSize: {
				get: function(){
					return THIS.headingHeight + content.scrollHeight !== el.scrollHeight;
				}
			}
		});
		
		
		
		THIS.index        = folds.push(THIS) - 1;
		THIS.accordion    = accordion;
		THIS.el           = el;
		THIS.heading      = heading;
		THIS.content      = content;
		THIS.ariaEnabled  = !accordion.noAria;
		THIS.heightOffset = accordion.heightOffset;
		el.accordionFold  = THIS.index;
		useBorders        = "auto" === useBorders ? (0 !== THIS.elBorder + THIS.headingBorder) : useBorders;
		
		
		
		function checkIDs(){
			var headingSuffix = "-heading";
			var contentSuffix = "-content";
			var elID            = el.id;
			var id;
			
			// Neither of the fold's elements have an ID attribute
			if(!heading.id && !content.id){
				id             = elID || uniqueID("a");
				heading.id     = id + headingSuffix;
				content.id     = id + contentSuffix;
			}
			
			// Either the heading or element lack an ID
			else if(!content.id) content.id   = (elID || heading.id) + contentSuffix;
			else if(!heading.id) heading.id   = (elID || content.id) + headingSuffix;
			
			// Finally, double-check each element's ID is really unique
			var $ = function(s){return document.querySelectorAll("#"+s)};
			while($(content.id).length > 1 || $(heading.id).length > 1){
				id         = uniqueID("a");
				content.id = id + contentSuffix;
				heading.id = id + headingSuffix;
			}
			
			// Update ARIA attributes
			heading.setAttribute("aria-controls",    content.id);
			content.setAttribute("aria-labelledby",  heading.id);
		}
		
		
		
		// Keyboard navigation
		if(keysEnabled){
			heading.tabIndex = 0;
			heading.addEventListener("keydown", onKeyDown = function(e){
				var key = e.keyCode;
				var fold;
				
				switch(key){

					// Spacebar: Toggle
					case 32:
						e.preventDefault(); // Fall-through
					
					
					// Enter: Toggle
					case 13:
						THIS.open = !THIS.open;
						if("A" === e.target.tagName)
							e.preventDefault();
						break;
					
					
					// Escape: Clear focus
					case 27:
						e.target.blur();
						break;
					
					
					// Up arrow: Previous section
					case 38:{
						
						// Is there a previous sibling to navigate up to?
						if(fold = THIS.previousFold){
							var children = fold.childAccordions;
							
							// Is it open, and does it have nested accordions?
							if(fold.open && children){
								var lastAcc;
								var lastFold;
								
								// Locate the deepest/nearest accordion that's currently exposed
								while(children){
									lastAcc  = children[children.length - 1];
									lastFold = lastAcc.folds[lastAcc.folds.length - 1];
									if(!lastFold.open) break;
									children = lastFold.childAccordions;
								}
								
								lastFold.heading.focus();
							}
							
							// Nope
							else fold.heading.focus();
						}
						
						// Is there a higher level we can jump back up to?
						else if(accordion.parent)
							accordion.parentFold.heading.focus();
						
						// There's nothing to move back to, so just let the browser run its usual behaviour
						else return true;
						
						e.preventDefault();
						return false;
					}
					
					
					
					// Down arrow: Next section
					case 40:{
						var children = THIS.childAccordions;
						
						// Is there a nested accordion to jump into?
						if(THIS.open && children)
							children[0].folds[0].heading.focus();
						
						// No, there isn't. Is there another sibling to move down to?
						else if(fold = THIS.nextFold)
							fold.heading.focus();
						
						// Is there a containing accordion we can navigate back up to?
						else if(THIS.accordion.parent){
							var parent = THIS;
							while(parent = parent.accordion.parentFold)
								if(fold = parent.nextFold){
									fold.heading.focus();
									break;
								}
							
							// Nowhere left to go...
							if(!parent) return true;
						}
						
						// Nah. Just scroll the window normally, as per browser default
						else return true;
						
						e.preventDefault();
						return false;
					}
					
					
					// Left arrow
					case 37:{
						
						// Close an opened section
						if(THIS.open) THIS.open = false;
						
						// Switch focus back to parent
						else if(accordion.parent)
							accordion.parentFold.heading.focus();
						
						break;
					}
					
					// Right arrow
					case 39:{
						var children = THIS.childAccordions;
						
						// Open a closed section
						if(!THIS.open) THIS.open = true;
						
						// Switch focus to a nested accordion
						else if(children)
							children[0].folds[0].heading.focus();
						
						break;
					}
				}
			});
		}
		
		
		// Listener to record the viewport's scroll offsets at the beginning of a touch
		touchEnabled && heading.addEventListener("touchstart", onTouchStart = function(e){
			scrollX = window.pageXOffset;
			scrollY = window.pageYOffset;
		}, {passive: true});
		
		
		heading.addEventListener(pressEvent, onPress = function(e){
			
			// Pressed on something inside the header
			if(e.target !== heading && heading.contains(e.target)){
				
				// Cancel fold-toggle if user clicked on an anchor-link
				if("A" === e.target.tagName && e.target.href)
					return true;
			}
			
			if(e.type !== "touchend" || (e.cancelable && window.pageXOffset === scrollX && window.pageYOffset === scrollY)){
				THIS.open = !THIS.open;
				e.preventDefault();
			}
			return false;
		});
		
		
		
		
		/**
		 * Adjust a fold's container to fit its content.
		 */
		function fit(){
			var height = THIS.headingHeight;
			if(THIS.open)   height += content.scrollHeight;
			if(useBorders)  height += THIS.elBorder;
			THIS.height = height;
		}
	}







	var accordions       = [];
	var activeAccordions = 0;
	var lastResizeRate;


	/**
	 * Represents a column of collapsible content regions.
	 *
	 * @param {HTMLElement} el                    - Container wrapped around each immediate fold
	 * @param {Object}      options               - Optional hash of settings
	 * @param {String}      options.openClass     - CSS class controlling each fold's "open" state
	 * @param {String}      options.closeClass    - CSS class used to mark a fold as closed
	 * @param {String}      options.edgeClass     - CSS class toggled based on whether the bottom-edge is visible
	 * @param {String}      options.snapClass     - CSS class for disabling transitions between window resizes
	 * @param {String}      options.enabledClass  - CSS class marking an accordion as enabled
	 * @param {String}      options.disabledClass - CSS class marking an accordion as disabled
	 * @param {Boolean}     options.disabled      - Whether to disable the accordion on creation
	 * @param {Boolean}     options.modal         - Whether to close the current fold when opening another
	 * @param {Boolean}     options.noAria        - Disable the addition and management of ARIA attributes
	 * @param {Boolean}     options.noKeys        - Disable keyboard navigation
	 * @param {Boolean}     options.noTransforms  - Disable CSS transforms; positioning will be used instead
	 * @param {Number}      options.heightOffset  - Distance to offset each fold by
	 * @param {Boolean}     options.useBorders    - Consider borders when calculating fold heights
	 * @param {Function}    options.onToggle      - Callback executed when opening or closing a fold
	 * @constructor
	 */
	var Accordion = function(el, options){
		var THIS          = this;
		var elClasses     = el.classList;
		var options       = options || {};
		var edgeClass     = (undefined === options.edgeClass    ? "edge-visible" : options.edgeClass);
		var snapClass     = (undefined === options.snapClass    ? "snap"         : options.snapClass);
		var enabledClass  = (undefined === options.enabledClass ? "accordion"    : options.enabledClass);
		var disabledClass = options.disabledClass;
		var _height, _disabled, _parent, _parentFold, _modal;


		Object.defineProperties(THIS, {
			update:     {value: update},
			updateFold: {value: updateFold},
			refresh:    {value: refresh},
			
			// Whether the accordion's been deactivated
			disabled: {
				get: function(){ return _disabled; },
				set: function(input){
					if((input = !!input) !== _disabled){
						var style   = el.style;
						var folds   = THIS.folds;
						
						enabledClass  && setToken(elClasses, enabledClass,  !input);
						disabledClass && setToken(elClasses, disabledClass,  input);
						
						
						// Deactivating
						if(_disabled = input){
							style.height = null;
							snapClass && elClasses.remove(snapClass);
							if(edgeClass){
								el.removeEventListener(transitionEnd, THIS.onTransitionEnd);
								elClasses.remove(edgeClass);
							}
							
							for(var i = 0, l = folds.length; i < l; ++i)
								folds[i].disabled = true;
							
							THIS.noAria || el.removeAttribute("role");
							--activeAccordions;
						}
						
						
						// Reactivating
						else{
							for(var i = 0, l = folds.length; i < l; ++i)
								folds[i].disabled = false;
							
							THIS.noAria || el.setAttribute("role", "tablist");
							++activeAccordions;
							update();
						}
						

						
						// If there're no more active accordions, disable the onResize handler
						if(activeAccordions <= 0){
							activeAccordions = 0;
							Accordion.setResizeRate(false);
						}
						
						// Otherwise, reactivate the onResize handler, assuming it was previously active
						else if(lastResizeRate)
							Accordion.setResizeRate(lastResizeRate);
					}
				}
			},
			
			// Get or set the accordion enclosing this one
			parent: {
				set: function(input){ _parent = input; },
				get: function(){
					var result = _parent;
					if(!result) return null;
					
					// Search for the first ancestor that *isn't* disabled
					while(result){
						if(!result.disabled) return result;
						result = result.parent;
					}
					return null;
				}
			},
			
			// Get or set the fold of the accordion enclosing this one
			parentFold: {
				set: function(input){ _parentFold = input; },
				get: function(){
					var fold = _parentFold;
					if(!fold) return null;
					
					var accordion = fold.accordion;
					
					// Search for the first ancestor that *isn't* disabled
					while(fold && accordion){
						if(!accordion.disabled) return fold;
						if(accordion = accordion.parent)
							fold = accordion.parentFold;
					}
					return null;
				}
			},
			
			// Height of the accordion's container element
			height: {
				get: function(){ return _height; },
				set: function(input){
					if(input && (input = +input) !== _height){
						el.style.height = input + "px";
						_height         = input;
					}
				}
			},
			
			// Whether one of the Accordion's folds has been resized incorrectly
			wrongSize: {
				get: function(){
					var a = this.folds;
					var l = a.length;
					var i = 0;
					for(; i < l; ++i) if(a[i].wrongSize) return true;
					if(a = this.childAccordions)
					for(; i < l; ++i) if(a[i].wrongSize) return true;
					return false;
				}
			},
			
			// Top-level ancestor this accordion's nested inside
			root: {
				get: function(){
					var result = this;
					while(result){
						if(!result.parent) return result;
						result = result.parent;
					}
				}
			}
		});

		
		// Assign options as properties
		THIS.openClass    = options.openClass  || "open";
		THIS.closeClass   = options.closeClass || "closed";
		THIS.modal        = !!options.modal;
		THIS.noAria       = !!options.noAria;
		THIS.noKeys       = !!options.noKeys;
		THIS.noTransforms = !!options.noTransforms;
		THIS.index        = accordions.push(THIS) - 1;
		THIS.heightOffset = +options.heightOffset || 0;
		THIS.useBorders   = undefined === options.useBorders ? "auto" : options.useBorders;
		THIS.onToggle     = options.onToggle;
		
		
		// Create a fold for each immediate descendant of the Accordion's container
		var folds = [];
		each.call(el.children, function(i){
			var fold = new Fold(THIS, i);
			folds.push(fold);
			
			// Connect the fold to its previous sibling, if it's not the first to be added
			var prev = folds[folds.length - 2];
			if(prev){
				prev.nextFold     = fold;
				fold.previousFold = prev;
			}
		});
		
		
		el.accordion    = THIS.index;
		THIS.noAria || el.setAttribute("role", "tablist");
		THIS.el         = el;
		THIS.folds      = folds;
		
		// Add .enabledClass early - it might affect the heights of each fold
		if(!options.disabled && enabledClass)
			elClasses.add(enabledClass);
		
		update();
		
		
		// Find out if this accordion's nested inside another
		var next = el;
		while((next = next.parentNode) && 1 === next.nodeType){
			var fold = Accordion.getFold(next);
			if(fold){
				var accordion   = fold.accordion;
				THIS.parent     = accordion;
				THIS.parentFold = fold;
				edgeClass && elClasses.remove(edgeClass);
				(accordion.childAccordions = accordion.childAccordions || []).push(THIS);
				(fold.childAccordions      = fold.childAccordions      || []).push(THIS);

				// Adjust the height of the containing fold's element
				if(fold.open){
					var scrollHeight = fold.el.scrollHeight;
					var distance     = (fold.headingHeight + fold.content.scrollHeight) - scrollHeight || (scrollHeight - fold.el.clientHeight);
					accordion.updateFold(fold, distance);
				}
				break;
			}
		}
		
		
		edgeClass && el.addEventListener(transitionEnd, this.onTransitionEnd = function(e){
			if(!THIS.parent && e.target === el && "height" === e.propertyName && el.getBoundingClientRect().bottom > window.innerHeight)
				elClasses.remove(edgeClass);
		});
		
		this.disabled = !!options.disabled;
		
		
		
		/**
		 * Internal method to check if an accordion's bottom-edge is visible to the user (or about to be).
		 *
		 * @param {Number} offset
		 * @private
		 */
		function edgeCheck(offset){
			if(edgeClass){
				var box         = el.getBoundingClientRect();
				var windowEdge  = window.innerHeight;
				
				// If the bottom-edge is visible (or about to be), enable height animation
				if(box.bottom + (offset || 0) < windowEdge)
					elClasses.add(edgeClass)
				
				// If the bottom-edge isn't visible anyway, disable height animation immediately
				else if(box.bottom > windowEdge)
					elClasses.remove(edgeClass);
			}
		}
		
		
		
		/**
		 * Update the vertical ordinate of each sibling for a particular fold.
		 *
		 * @param {Fold} fold
		 * @param {Number} offset - Pixel distance to adjust by
		 */
		function updateFold(fold, offset){
			var next = fold;
			var parentFold = THIS.parentFold;
			
			while(next = next.nextFold)
				next.y  += offset;
			parentFold || edgeCheck(offset);
			fold.height += offset;
			THIS.height += offset;
			
			parentFold && parentFold.open && THIS.parent.updateFold(parentFold, offset);
		}
		
		
		/**
		 * Update the height of each fold to fit its content.
		 */
		function update(){
			var y      = 0;
			var height = 0;
			var i      = 0;
			var l      = folds.length;
			var parentFold = THIS.parentFold;
			var fold, diff;
			
			for(; i < l; ++i){
				fold   = folds[i];
				fold.y = y;
				fold.fit();
				y      += fold.height;
				height += fold.height;
			}
			
			diff = height - _height;
			parentFold
				? (parentFold.open && THIS.parent.updateFold(parentFold, diff))
				: edgeCheck(diff);
			
			THIS.height = height;
		}
		
		
		
		/**
		 * Recalculate the boundaries of an Accordion and its descendants.
		 *
		 * This method should only be called if the width of a container changes,
		 * or a fold's contents have resized unexpectedly (such as when images load).
		 *
		 * @param {Boolean} allowSnap - Snap folds instantly into place without transitioning
		 */
		function refresh(allowSnap){
			var snap = allowSnap ? snapClass : false;
			snap && elClasses.add(snap);
			
			THIS.update();
			THIS.childAccordions && THIS.childAccordions.forEach(function(a){
				a.parentFold.open
					? a.refresh(allowSnap)
					: (a.parentFold.needsRefresh = true);
			});
			
			snap && setTimeout(function(e){elClasses.remove(snap)}, 20);
		}
	}

	// If IE8PP exists, it means the author wants/needs IE8 support. See also: tinyurl.com/fixIE8-9
	if("function" === typeof IE8PP)
		Accordion = IE8PP(Accordion),
		Fold      = IE8PP(Fold);



	/**
	 * Alter the rate at which screen-resize events update accordion widths.
	 *
	 * @param {Number} delay - Rate expressed in milliseconds
	 */
	Accordion.setResizeRate = function(delay){
		var fn = function(e){
			for(var a, i = 0, l = accordions.length; i < l; ++i){
				a = accordions[i];
				a.parent || a.disabled || a.refresh(true);
			}
		};
		
		var THIS = Accordion;
		THIS.onResize && window.removeEventListener("resize", THIS.onResize);
		
		// Make sure we weren't passed an explicit value of FALSE, or a negative value
		if(false !== delay && (delay = +delay || 0) >= 0){
			THIS.onResize = delay ? debounce(fn, delay) : fn;
			window.addEventListener("resize", THIS.onResize);
			if(delay) lastResizeRate = delay;
		}
	}
	
	
	
	/**
	 * Return the closest (most deeply-nested) accordion enclosing an element.
	 *
	 * @param {Node} node
	 * @return {Accordion}
	 */
	Accordion.getAccordion = function(node){
		while(node){
			if("accordion" in node)
				return accordions[node.accordion];
			
			node = node.parentNode;
			if(!node || node.nodeType !== 1) return null;
		}
	}
	
	
	/**
	 * Return the closest (most deeply-nested) fold enclosing an element.
	 *
	 * @param {Node} node
	 * @return {Fold}
	 */
	Accordion.getFold = function(node){
		while(node){
			if("accordionFold" in node)
				return folds[node.accordionFold];
			
			node = node.parentNode;
			if(!node || node.nodeType !== 1) return null;
		}
	}
	

	
	Accordion.setResizeRate(25);
	
	
	// Browser export
	window.Accordion = Accordion;
	
	// CommonJS/Node.js
	if("object" === typeof module && "object" === typeof module.exports)
		module.exports.Accordion = Accordion;
	
	// AMD/UMD-like systems
	return Accordion;
}());