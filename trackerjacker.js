



/**
 * trackerjacker.js
 *
 * * Copyright 2015: Ken L.
 * Licensed under the GPL Version 3 license.
 * http://www.gnu.org/licenses/gpl.html
 * 
 * This script is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This script is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * 
 * The goal of this script is to be an iniative tracker, that manages statuses,
 * effects, and durations.
 * 
 * 1. It should advance the turn order and display a notification in chat with
 * optional toggles. 
 * 
 * 1.1 It should have the ability to announce rounds
 * 
 * 2. It should allow some kind of underlay graphic with or without some kind of
 * underlay graphic like TurnMarker.js
 * 
 * 3. It should have the ability to tie status conditions to tokens with concise
 * visual cues to relay to chat (IE fog cloud has X turns remaining on it or has lasted N turns).
 * 
 * 4. It should be extensible to other scripts by exposing a call structure for
 * a speedier access of innate functions without cluttering up the message queue. TODO
 * 
 * 5. It should be verbose in terms of error reporting where all are recoverable.
 * 
 * 6. It should save turn information within the state object to ensure recovery
 * of all effects in the event of API connection failure.
 * 
 * 7. It should be lightweight with a minimal amount of passed messages.
 * 
 * 
 * 
 * 
 */
 
var TrackerJacker = (function() {
	'use strict'; 
	var version = 1.081,
		author = 'Ken L.',
		pending = null;
	
	var TJ_StateEnum = Object.freeze({
		ACTIVE: 0,
		PAUSED: 1,
		STOPPED: 2,
		FROZEN: 3
	});

	var PR_Enum = Object.freeze({
		YESNO: 'YESNO',
		CUSTOM: 'CUSTOM',
	});

	var fields = {
		feedbackName: 'TrackerJacker',
		feedbackImg: 'https://s3.amazonaws.com/files.d20.io/images/11514664/jfQMTRqrT75QfmaD98BQMQ/thumb.png?1439491849',
		
		trackerId: '',
		trackerName: 'trackerjacker_tracker',
		
		trackerImg: 'https://s3.amazonaws.com/files.d20.io/images/11920268/i0nMbVlxQLNMiO12gW9h3g/thumb.png?1440939062',
		//trackerImg: 'https://s3.amazonaws.com/files.d20.io/images/6623517/8xw1KOSSOO1WocN3KQYmzw/thumb.png?1417994946',
		trackerImgRatio: 2.25,
		rotation_degree: 10,
	}; 
	
	var flags = {
		tj_state: TJ_StateEnum.STOPPED, image: true,
		rotation: true,
		animating: false,
		archive: false,
		clearonclose: true
	};
	
	var design = {
		turncolor: '#D8F9FF',
		roundcolor: '#363574',
		statuscolor: '#F0D6FF',
		statusbgcolor: '#897A87',
		statusbordercolor: '#430D3D',
		edit_icon: 'https://s3.amazonaws.com/files.d20.io/images/11380920/W_Gy4BYGgzb7jGfclk0zVA/thumb.png?1439049597',
		delete_icon: 'https://s3.amazonaws.com/files.d20.io/images/11381509/YcG-o2Q1-CrwKD_nXh5yAA/thumb.png?1439051579',
		settings_icon: 'https://s3.amazonaws.com/files.d20.io/images/11920672/7a2wOvU1xjO-gK5kq5whgQ/thumb.png?1440940765', 
		apply_icon: 'https://s3.amazonaws.com/files.d20.io/images/11407460/cmCi3B1N0s9jU6ul079JeA/thumb.png?1439137300'
	};
	
	var statusMarkers = Object.freeze([
		{name:"red",img:'https://s3.amazonaws.com/files.d20.io/images/8123890/TkC_M8_6X-UHy8euEymakQ/thumb.png?1425804412'},
		{name:"blue",img:'https://s3.amazonaws.com/files.d20.io/images/8123884/pV7HJJVqORAhrOftpmVHUw/thumb.png?1425804373'},
		{name:"green",img:'https://s3.amazonaws.com/files.d20.io/images/8123885/sbim5jTRF3XsuSs01ycKrg/thumb.png?1425804385'},
		{name:"brown",img:'https://s3.amazonaws.com/files.d20.io/images/8123886/q0axCUI6vBsvDGOwFbsBXw/thumb.png?1425804393'},
		{name:"purple",img:'https://s3.amazonaws.com/files.d20.io/images/8123889/xEOFbIKegEaFgN0vLnzG0g/thumb.png?1425804406'},
		{name:"pink",img:'https://s3.amazonaws.com/files.d20.io/images/8123887/iyJDiq2Ngwuh6Si3-FLztQ/thumb.png?1425804400'},
		{name:"yellow",img:'https://s3.amazonaws.com/files.d20.io/images/8123892/oL21nVVRUpDjGLaHXftstQ/thumb.png?1425804422'},
		{name:"dead",img:'https://s3.amazonaws.com/files.d20.io/images/8093499/ca_OFvFT0w_MtJKY6c83Ew/thumb.png?1425688175'},
		{name:"skull",img:'https://s3.amazonaws.com/files.d20.io/images/8074161/wpqmZJQlkzmyee0_lsNv4A/thumb.png?1425598594'},
		{name:"sleepy",img:'https://s3.amazonaws.com/files.d20.io/images/8074159/PaeQH3jsdmPbUOiODPx5fg/thumb.png?1425598590'},
		{name:"half-heart",img:'https://s3.amazonaws.com/files.d20.io/images/8074186/k5X_UUMwcuq1LZjEL58mpA/thumb.png?1425598650'},
		{name:"half-haze",img:'https://s3.amazonaws.com/files.d20.io/images/8074190/YvdObVqX0hT711vcbML7OA/thumb.png?1425598654'},
		{name:"interdiction",img:'https://s3.amazonaws.com/files.d20.io/images/8074185/cyt6rWIaUiMvq-4CnpskZQ/thumb.png?1425598647'},
		{name:"snail",img:'https://s3.amazonaws.com/files.d20.io/images/8074158/YDHHfsu8T8wcqbby33fweA/thumb.png?1425598587'},
		{name:"lightning-helix",img:'https://s3.amazonaws.com/files.d20.io/images/8074184/iUPFB-lXP9ySnktTut-3uA/thumb.png?1425598643'},
		{name:"spanner",img:'https://s3.amazonaws.com/files.d20.io/images/8074154/2qufcEnyNJqjSN_f9XrgiQ/thumb.png?1425598583'},
		{name:"chained-heart",img:'https://s3.amazonaws.com/files.d20.io/images/8074213/f6jmFoQWX-7KRsux_HaIqg/thumb.png?1425598699'},
		{name:"chemical-bolt",img:'https://s3.amazonaws.com/files.d20.io/images/8074212/B-U3tyYf06An3NonHrh1xA/thumb.png?1425598696'},
		{name:"death-zone",img:'https://s3.amazonaws.com/files.d20.io/images/8074210/CPzQbQ8h-vZnNinShD1L_Q/thumb.png?1425598689'},
		{name:"drink-me",img:'https://s3.amazonaws.com/files.d20.io/images/8074207/bElenkvmnfe15u6e23_XxQ/thumb.png?1425598686'},
		{name:"edge-crack",img:'https://s3.amazonaws.com/files.d20.io/images/8074206/7N52ErC13lHDxRwrt-igyQ/thumb.png?1425598682'},
		{name:"ninja-mask",img:'https://s3.amazonaws.com/files.d20.io/images/8074181/XDbfFm8Ul3Iy7zkiDB321w/thumb.png?1425598638'},
		{name:"stopwatch",img:'https://s3.amazonaws.com/files.d20.io/images/8074152/UW9235lWLTTryx6zCP2MQA/thumb.png?1425598581'},
		{name:"fishing-net",img:'https://s3.amazonaws.com/files.d20.io/images/8074205/v83unarpA-nUZqp2HKOr0w/thumb.png?1425598678'},
		{name:"overdrive",img:'https://s3.amazonaws.com/files.d20.io/images/8074178/CYZFHZzMBdssRjoxWvP7MQ/thumb.png?1425598630'},
		{name:"strong",img:'https://s3.amazonaws.com/files.d20.io/images/8074151/DHoYUsnyz2AOaTVGR5mV7A/thumb.png?1425598577'},
		{name:"fist",img:'https://s3.amazonaws.com/files.d20.io/images/8074201/GZ0py5UxO7pFUOfobTKGVw/thumb.png?1425598674'},
		{name:"padlock",img:'https://s3.amazonaws.com/files.d20.io/images/8074174/euydq4AuqYk_7y0GqObChw/thumb.png?1425598626'},
		{name:"three-leaves",img:'https://s3.amazonaws.com/files.d20.io/images/8074149/3GodR7irhqJXoQcfm7tkng/thumb.png?1425598573'},
		{name:"fluffy-wing",img:'https://s3.amazonaws.com/files.d20.io/images/8093436/nozRPKmjhulSuQZO-NV7xw/thumb.png?1425687966'},
		{name:"pummeled",img:'https://s3.amazonaws.com/files.d20.io/images/8074171/pPhgEmVHP6bHMbcj-wn98g/thumb.png?1425598619'},
		{name:"tread",img:'https://s3.amazonaws.com/files.d20.io/images/8074145/-hBmfcug0Bhr7nWxXMNd1A/thumb.png?1425598570'},
		{name:"arrowed",img:'https://s3.amazonaws.com/files.d20.io/images/8074234/Z48uPYYNGR5iD4DEy3RYbA/thumb.png?1425598735'},
		{name:"aura",img:'https://s3.amazonaws.com/files.d20.io/images/8074231/g6ogG9gDMBsIG_fdx-Hl5w/thumb.png?1425598731'},
		{name:"back-pain",img:'https://s3.amazonaws.com/files.d20.io/images/8074229/xdGkbAHaELU5HK9rpMUZkg/thumb.png?1425598727'},
		{name:"black-flag",img:'https://s3.amazonaws.com/files.d20.io/images/8074226/mJgQqm9Hl3ek75xoXcecVg/thumb.png?1425598724'},
		{name:"bleeding-eye",img:'https://s3.amazonaws.com/files.d20.io/images/8074224/IdGVnqxciFoDI6dXLyoSgA/thumb.png?1425598720'},
		{name:"bolt-shield",img:'https://s3.amazonaws.com/files.d20.io/images/8074221/8E3S_XJF1rpkYmkQc7iwcw/thumb.png?1425598713'},
		{name:"broken-heart",img:'https://s3.amazonaws.com/files.d20.io/images/8074218/ylXLOkQFHyAaj6kumKEaOw/thumb.png?1425598709'},
		{name:"cobweb",img:'https://s3.amazonaws.com/files.d20.io/images/8074211/KNY0AO4fj2md_M2n6Uf4IQ/thumb.png?1425598692'},
		{name:"broken-shield",img:'https://s3.amazonaws.com/files.d20.io/images/8074217/wV6Cx457yk_jTwjKzWRVXw/thumb.png?1425598706'},
		{name:"flying-flag",img:'https://s3.amazonaws.com/files.d20.io/images/8074198/n2hH7I_YrEXNYb1jh0Oo5Q/thumb.png?1425598670'},
		{name:"radioactive",img:'https://s3.amazonaws.com/files.d20.io/images/8074167/4zCBr9YKxZvRuhDo2VWQnQ/thumb.png?1425598611'},
		{name:"trophy",img:'https://s3.amazonaws.com/files.d20.io/images/8074143/QVNHRiiQ56k6Mn2rro3_bg/thumb.png?1425598567'},
		{name:"broken-skull",img:'https://s3.amazonaws.com/files.d20.io/images/8074215/rTI3ahu2dE3VKO-W7i3jcw/thumb.png?1425598702'},
		{name:"frozen-orb",img:'https://s3.amazonaws.com/files.d20.io/images/8074197/K7xZkKvW0GeMvwkm8VfxTg/thumb.png?1425598666'},
		{name:"rolling-bomb",img:'https://s3.amazonaws.com/files.d20.io/images/8074165/fd9kK4Peiprwr8wyI_pcEQ/thumb.png?1425598604'},
		{name:"white-tower",img:'https://s3.amazonaws.com/files.d20.io/images/8074141/M5p2-7dryUVxCJjhUcJe5Q/thumb.png?1425598564'},
		{name:"grab",img:'https://s3.amazonaws.com/files.d20.io/images/8074194/tfeQLEm-AmBi_IMF-h8vEg/thumb.png?1425598663'},
		{name:"screaming",img:'https://s3.amazonaws.com/files.d20.io/images/8074163/CwKqOWu7ZprFzkkcafs8cQ/thumb.png?1425598601'},
		{name:"grenade",img:'https://s3.amazonaws.com/files.d20.io/images/8074191/dd_UjtADigCKYzcP4RBCVg/thumb.png?1425598657'},
		{name:"sentry-gun",img:'https://s3.amazonaws.com/files.d20.io/images/8074162/rlpAA3Eg04Ct8csKCjbcdQ/thumb.png?1425598597'},
		{name:"all-for-one",img:'https://s3.amazonaws.com/files.d20.io/images/8074239/2VxQwqrsz5BXvXIkraKE1g/thumb.png?1425598746'},
		{name:"angel-outfit",img:'https://s3.amazonaws.com/files.d20.io/images/8074238/dKSnapoJ7JyGcINc8PIA1Q/thumb.png?1425598742'},
		{name:"archery-target",img:'https://s3.amazonaws.com/files.d20.io/images/8074237/ei4JHB51P6az3slwgZmTEw/thumb.png?1425598739'}
	]);

	var TrackerJacker_tmp = (function() {
		var templates = {
			button: _.template('<a style="display: inline-block; font-size: 100%; color: black; padding: 3px 3px 3px 3px; margin: 2px 2px 2px 2px; border: 1px solid black; border-radius: 0.5em; font-weight: bold; text-shadow: -1px -1px 1px #FFF, 1px -1px 1px #FFF, -1px 1px 1px #FFF, 1px 1px 1px #FFF; background-color: #C7D0D2;" href="<%= command %>"><%= text %></a>'),
			confirm_box: _.template('<div style="font-weight: bold; background-color: #FFF; text-align: center; box-shadow: rgba(0,0,0,0.4) 3px 3px; border-radius: 1em; border: 1px solid black; margin: 5px 5px 5px 5px; padding: 2px 2px 2px 2px;">'
					+ '<div style="border-bottom: 1px solid black;">'
						+ '<%= message %>'
					+ '</div>'
					+ '<table style="text-align: center; width: 100%">'
						+ '<tr>'
							+ '<td>'
								+ '<%= confirm_button %>'
							+ '</td>'
							+ '<td>'
								+ '<%= reject_button %>'
							+ '</td>'
						+ '</tr>'
					+ '</table>'
				+ '</div>')
		};

		return {
			getTemplate: function(tmpArgs, type) {
				var retval;
				
				retval = _.find(templates, function(e,i) {
					if (type === i) {
						{return true;}
					}
				})(tmpArgs);
				
				return retval;
			},
			
			hasTemplate: function(type) {
				if (!type) 
					{return false;}
				return !!_.find(_.keys(templates), function(elem) {
					{return (elem === type);}
				});
				
			}
		};
	}());

	/**
	 * PendingResponse constructor
	 */
	var PendingResponse = function(type,func,args) {
		if (!type || !args) 
			{return undefined;}
		
		this.type = type;
		this.func = func;
		this.args = args;
	};
	
	/**
	 * PendingResponse prototypes
	 */
	PendingResponse.prototype = {
		getType: function() { return this.type; },
		getArgs: function() { return this.args; },
		doOps: function(carry) {
			if (!this.func) 
				{return null;}
			return this.func(this.args,carry); 
		},
		doCustomOps: function(args) { return this.func(args); },
	};

	/**
	 * Add a pending response to the stack, return the associated hash
	 * TODO make the search O(1) rather than O(n)
	 */
	var addPending = function(pr,hash) {
		if (!pr) 
			{return null;}
		if (!hash) 
			{hash = genHash(pr.type+pr.args,pending);}
		var retval = hash;
		if (pending) {
			if (pending[hash]) {
				throw 'hash already in pending queue';
			}
			pending[hash] = {};
			pending[hash].pr = pr; 
		} else {
			pending = {};
			pending[hash] = {};
			pending[hash].pr = pr; 
		}
		return retval;
	};
	
	/**
	 * find a pending response
	 */
	var findPending = function(hash) {
		var retval = null;
		if (!pending)
			{return retval;}
		retval = pending[hash]; 
		if (retval) 
			{retval = retval.pr;}
		return retval;
	};
	
	/**
	 * Clear pending responses
	 */
	var clearPending = function(hash) {
		if (pending[hash])
			{delete pending[hash]; }
	};

	/**
	* @author lordvlad @stackoverflow
	* @contributor Ken L.
	*/
	var genHash = function(seed,hashset) {
		if (!seed) 
			{return null;}
		seed = seed.toString();
		var hash = seed.split("").reduce(function(a,b) {a=((a<<5)-a)+b.charCodeAt(0);return a&a;},0);
		if (hashset && hashset[hash]) {
			var d = new Date();
			return genHash((hash+d.getTime()*Math.random()).toString(),hashset);
		}
		return hash;
	}; 

	/**
	 * Init
	 */
	var init = function() {
		if (!state.trackerjacker)
			{state.trackerjacker = {};}
		if (!state.trackerjacker.effects)
			{state.trackerjacker.effects = {};}
		if (!state.trackerjacker.statuses) 
			{state.trackerjacker.statuses = [];}
		if (!state.trackerjacker.favs)
			{state.trackerjacker.favs = {};}
	}; 
	
	/**
	 * check if the character object exists, return first match
	 */
	var characterObjExists = function(name, type, charId) {
		var retval = null;
		var obj = findObjs({
			_type: type,
			name: name,
			_characterid: charId 
		});
		if (obj.length > 0)
			{retval = obj[0];}
		return retval;
	}; 
	
	/**
	 * Return the string with the roll formatted, this is accomplished by simply
	 * surrounding roll equations with [[ ]] TODO, should be replaced with a
	 * single regex
	 * 
	 */
	var getFormattedRoll = function(str) {
		if (!str) {return "";}
		var retval = str,
			re = /\d+d\d+/,
			idx, 
			expr, 
			roll, 
			pre, 
			post;

		if ((roll=re.exec(str))) {
			expr = getExpandedExpr(roll[0],str,roll.index);
			idx = str.indexOf(expr);
			pre = str.substring(0,idx);
			post = str.substring(idx+expr.length);
		} else { return retval;}
		
		return pre+"[["+expr+"]]"+getFormattedRoll(post);
	};
	
	/**
	 * Return the target expression expanded as far as it logically can span
	 * within the provided line.
	 * 
	 * ie: target = 1d20
	 *	   locHint = 4
	 *	   line = "2+1d20+5+2d4 bla (bla 1d20+8 bla) bla (4d8...) bla bla"
	 * 
	 * result = 2+1d20+5+2d4
	 */
	var getExpandedExpr = function(target, line, locHint) {
		if (!target || !line) 
			{return;}
		if (!locHint) 
			{locHint = 0;}
		var retval = target,
			re = /\d|[\+\-]|d/,
			loc = -1, 
			start = 0, 
			end = 0;
		
		if((loc=line.indexOf(target,locHint)) !== -1) {
			start = loc;
			while (start > 0) {
				if (line[start].match(re))
					{start--;}
				else
					{start++;break;}
			}
			end = loc;
			while (end < line.length) {
				if (line[end].match(re))
					{end++;}
				else
					{break;}
			}
			retval = line.substring(start,end);
			retval = getLegalRollExpr(retval);
		}
		
		return retval;
	};
	
	/**
	 * Gets a legal roll expression.
	 */
	var getLegalRollExpr = function(expr) {
		if (!expr) {return;}
		var retval = expr,
			stray = expr.match(/d/g),
			valid = expr.match(/\d+d\d+/g),
			errMsg = "Illegal expression " + expr; 
		
		try {
			if (expr.match(/[^\s\d\+-d]/g) || 
			!stray || 
			!valid || 
			(stray.length =! valid.length))
				{throw errMsg;}

			stray = expr.match(/\+/g);
			valid = expr.match(/\d+\+\d+/g);
			if ((stray !== null) && (valid !== null) && 
			(stray.length !== valid.length))
				{throw errMsg;}
			stray = expr.match(/-/g);
			valid = expr.match(/\d+-\d+/g);
			if ((stray !== null) && (valid !== null) && 
			(stray.length !== valid.length))
				{throw errMsg;}
		} catch (e) {
			throw e;
		}
		
		//check for leading, trailing, operands
		if (retval[0].match(/\+|-/))
			{retval = retval.substring(1);}
		if (retval[retval.length-1].match(/\+|-/))
				{retval = retval.substring(0,retval.length-1);}
		
		return retval;
	};

	/**
	 * Prepare the turn order by checking if the tracker is present,
	 * if so, then we're resuming a previous turnorder (perhaps a restart).
	 * Fetch information from the state and double check that all refereces
	 * line up. If any references don't line up anymore, inform the GM of
	 * this, then remove them from the tracker. In the case of items existing
	 * on the tracker, perform normal impomtu add behavior.
	 */
	var prepareTurnorder = function(turnorder) {
		if (!turnorder) 
			{turnorder = Campaign().get('turnorder');}
		if (!turnorder) 
			{turnorder = [];}
		else if (typeof(turnorder) === 'string') 
			{turnorder = JSON.parse(turnorder);}
		var tracker; 

		if (tracker = _.find(turnorder, function(e,i) {if (parseInt(e.id) === -1 && parseInt(e.pr) === -100 && e.custom.match(/Round\s*\d+/)){return true;}})) {
			// resume logic
		} else {
			turnorder.push({
				id: '-1',
				pr: '-100',
				custom: 'Round 1',
			});
			//TODO only clear statuses that have a duration
			updateTurnorderMarker(turnorder);
		}
		if (!state.trackerjacker)
			{state.trackerjacker = {};}
		if (!state.trackerjacker.effects)
			{state.trackerjacker.effects = {};}
		if (!state.trackerjacker.statuses)
			{state.trackerjacker.statuses = [];}
		if (!state.trackerjacker.favs)
			{state.trackerjacker.favs = {};}
	};
	

	/**
	 * update the status display the appears beneath the turn order
	 */
	var updateStatusDisplay = function(curToken) {
		if (!curToken) {return;}
		var effects = getStatusEffects(curToken),
			gstatus,
			statusArgs,
			toRemove = [],
			content = '',
			hcontent = ''; 

		_.each(effects, function(e) {
			if (!e) {return;}
			statusArgs = e;
			gstatus = statusExists(e.name); 
			statusArgs.duration = parseInt(statusArgs.duration) + 
				parseInt(statusArgs.direction);
			if (gstatus.marker)
				{content += makeStatusDisplay(e);}
			else
				{hcontent += makeStatusDisplay(e)}
		});
		effects = _.reject(effects,function(e) {
			if (e.duration <= 0) {
				// remove from status args
				var removedStatus = updateGlobalStatus(e.name,undefined,-1);
				toRemove.push(removedStatus); 
				return true;	
			}
		});
		setStatusEffects(curToken,effects);
		updateAllTokenMarkers(toRemove); 			
		return {public: content, hidden: hcontent};
	};
	
	/**
	 * Update the global status array, if a status is removed, return the
	 * removed status (for final cleanup)
	 */
	var updateGlobalStatus = function(statusName, marker, inc) {
		if (!statusName || !inc || isNaN(inc)) {return;}
		var retval;
		statusName = statusName.toLowerCase();
		var found = _.find(state.trackerjacker.statuses, function(e) {
			if (e.name === statusName) {
				retval = e;
				e.refc += inc;
				if (e.refc <= 0) {
					state.trackerjacker.statuses = _.reject(state.trackerjacker.statuses, function(e) {
						if (e.name === statusName)
							{return true;}
					});
				}
				return true;
			}
			else if (e.marker && e.marker === marker) {
				return true;
			}
			return false;
		});
		
		if (!found) {
			state.trackerjacker.statuses.push({
				name: statusName.toLowerCase(),
				marker: marker,
				refc: inc
			}); 
		}
		return retval;
	}; 

	/**
	 * Updates every token marker related to a status
	 */
	var updateAllTokenMarkers = function(toRemove) {
		var token,
			effects,
			tokenStatusString,
			statusName,
			status,
			hasRemovedEffect;
		
		_.each(_.keys(state.trackerjacker.effects), function(e) {
			token = getObj('graphic',e);
			if (!token) {
				return; 
			}
			effects = getStatusEffects(token);
			tokenStatusString = token.get('statusmarkers');
			if (_.isUndefined(tokenStatusString) || tokenStatusString === 'undefined') {
				log('Unable to get status string for ' + e + ' status string is ' + tokenStatusString); 
				return;
			}
			tokenStatusString = tokenStatusString.split(',');
			_.each(effects, function(elem) {
				statusName = elem.name.toLowerCase(); 
				status = _.findWhere(state.trackerjacker.statuses,{name: statusName});
				if (status) {
					tokenStatusString = _.reject(tokenStatusString, function(j) {
						return j.match(new RegExp(status.marker+'@?[1-9]?$')); 
					}); 
					tokenStatusString.push(status.marker + ((elem.duration > 0 && elem.duration <= 9 && elem.direction !== 0) ? ('@'+elem.duration):'')); 
				}
			});
			
			if (!!toRemove) {
				_.each(toRemove,function(e) {
					if (!e) {return;}
					hasRemovedEffect = _.findWhere(effects,{name:e.name}); 
					if (!hasRemovedEffect) {
						tokenStatusString = _.reject(tokenStatusString, function(rre) {
							if (rre.match(new RegExp(e.marker+'@?[1-9]?$')) || 
							rre === 'undefined')
								{return true;}
						});
					}
				}); 
			}
			
			if (tokenStatusString.length > 0) {
				tokenStatusString = _.reduce(tokenStatusString,function(memo,str) {
					if (memo === 'undefined')
						{return str;}
					if (str === 'undefined')
						{return memo;}
					return ((memo ? (memo+','):'')+str);
				});
			}

			token.set('statusmarkers',(tokenStatusString||''));
		});
	}; 

	/**
	 * Update the tracker's marker in the turn order
	 */ 
	var updateTurnorderMarker = function(turnorder) {
		if (!turnorder) 
			{turnorder = Campaign().get('turnorder');}
		if (!turnorder) 
			{return;}
		if (typeof(turnorder) === 'string') 
			{turnorder = JSON.parse(turnorder);}
		var tracker,
			trackerpos; 
		
		if (!!(tracker = _.find(turnorder, function(e,i) {if (parseInt(e.id) === -1 && parseInt(e.pr) === -100 && e.custom.match(/Round\s*\d+/)){trackerpos = i;return true;}}))) {
			
			var indicator,
				graphic = findTrackerGraphic(),
				rounds = tracker.custom.substring(tracker.custom.indexOf('Round')).match(/\d+/); 

			if (rounds) 
				{rounds = parseInt(rounds[0]);}
			
			switch(flags.tj_state) {
				case TJ_StateEnum.ACTIVE:
					graphic.set('tint_color','transparent'); 
					indicator = '▶ ';
					break;
				case TJ_StateEnum.PAUSED:
					graphic = findTrackerGraphic();
					graphic.set('tint_color','#FFFFFF'); 
					indicator ='▍▍';
					break;
				case TJ_StateEnum.STOPPED:
					graphic.set('tint_color','transparent'); 
					indicator = '◼ ';
					break;
				default:
					indicator = tracker.custom.substring(0,tracker.custom.indexOf('Round')).trim();
					break;
			}
			tracker.custom = indicator + 'Round ' + rounds;
			
		}
		
		turnorder = JSON.stringify(turnorder);
		Campaign().set('turnorder',turnorder);
		
	};

	/**
	 * Status exists
	 */ 
	var statusExists = function(statusName) {
		return _.findWhere(state.trackerjacker.statuses,{name: statusName}); 
	}; 
	
	/**
	 * get status effects for a token
	 */
	var getStatusEffects = function(curToken) {
		if (!curToken) 
			{return;}
		
		var effects = state.trackerjacker.effects[curToken.get('_id')];
		if (effects && effects.length > 0) 
			{return effects;}
		return undefined;
	}; 
	
	/**
	 *  set status effects for a token
	 */ 
	var setStatusEffects = function(curToken,effects) {
		if (!curToken) 
			{return;}
		
		if(Array.isArray(effects))
			{state.trackerjacker.effects[curToken.get('_id')] = effects;}
	}; 

	/**
	 * Make the display for editing a status for multiple tokens.
	 * This differs from the single edit case in that it performs
	 * across several tokens. 
	 */ 
	var makeMultiStatusConfig = function(action, statusName, idString) {
		if (!action || !statusName || !idString) 
			{return;}

		var content = '',
			globalStatus = statusExists(statusName),
			mImg; 

		if (!statusName)
			{return '<span style="color: red; font-weight: bold;">Invalid syntax</span>'; }
		if (!globalStatus)
			{return '<span style="color: red; font-weight: bold;">Status no longer exists</span>'; }

		mImg = _.findWhere(statusMarkers,{name: globalStatus.marker}); 
		if (mImg) 
			{mImg = '<img src="' + mImg.img + '"></img>'; }
		else
		{mImg = 'none';}

		content += '<div style="background-color: '+design.statuscolor+'; border: 2px solid #000; box-shadow: rgba(0,0,0,0.4) 3px 3px; border-radius: 0.5em; text-align: center;">'
			+ '<div style="border-bottom: 2px solid black;">'
				+ '<table width="100%"><tr><td width="100%"><span style="font-weight: bold; font-size: 125%">Edit Group Status "'+statusName+'"</span></td></tr></table>'
			+ '</div>'
			+ '<table width="100%">' 
				+ '<tr style="background-color: #FFF; border-bottom: 1px solid '+design.statusbordercolor+';" >'
					+ '<td>'
						+ '<div><span style="font-weight: bold;">Name</span><br>'+'<span style="font-style: italic;">'+statusName+'</span></div>' 
					+ '</td>' 
					+ '<td width="32px" height="32px">' 
						+ '<a style= "width: 16px; height: 16px; border: 1px solid '+design.statusbordercolor+'; border-radius: 0.2em; background: none" title="Edit Name" href="!tj -edit_multi_status '
							+ statusName + ' @ name @ ?{name|'+statusName+'} @ ' + idString
							+ '"><img src="'+design.edit_icon+'"></img></a>' 
					+ '</td>'
				+ '</tr>' 
				+ '<tr style="background-color: #FFF; border-bottom: 1px solid '+design.statusbordercolor+';" >'
					+ '<td>'
						+ '<div><span style="font-weight: bold;">Marker</span><br>'+'<span style="font-style: italic;">'+mImg+'</span></div>' 
					+ '</td>' 
					+ '<td width="32px" height="32px">' 
						+ '<a style= "width: 16px; height: 16px; border: 1px solid '+design.statusbordercolor+'; border-radius: 0.2em; background: none" title="Edit Marker" href="!tj -edit_multi_status '
							+ statusName + ' @ marker @ 1 @ ' + idString
							+ '"><img src="'+design.edit_icon+'"></img></a>' 
					+ '</td>'
				+ '</tr>' 
				+ '<tr style="border-bottom: 1px solid '+design.statusbordercolor+';" >'
					+ '<td>'
						+ '<div><span style="font-weight: bold;">Duration</span><br>'+'<span style="font-style: italic;">Varies</span></div>' 
					+ '</td>' 
					+ '<td width="32px" height="32px">' 
						+ '<a style= "width: 16px; height: 16px; border: 1px solid '+design.statusbordercolor+'; border-radius: 0.2em; background: none" title="Edit Duration" href="!tj -edit_multi_status '
							+ statusName + ' @ duration @ ?{duration|1} @ ' + idString
							+ '"><img src="'+design.edit_icon+'"></img></a>' 
					+ '</td>'
				+ '</tr>' 
				+ '<tr style="border-bottom: 1px solid '+design.statusbordercolor+';" >'
					+ '<td>'
						+ '<div><span style="font-weight: bold;">Direction</span><br>'+'<span style="font-style: italic;">Varies</span></div>' 
					+ '</td>' 
					+ '<td width="32px" height="32px">' 
						+ '<a style= "width: 16px; height: 16px; border: 1px solid '+design.statusbordercolor+'; border-radius: 0.2em; background: none" title="Edit Direction" href="!tj -edit_multi_status '
							+ statusName + ' @ direction @ ?{direction|-1} @ ' + idString
							+ '"><img src="'+design.edit_icon+'"></img></a>' 
					+ '</td>'
				+ '</tr>'
				+ '<tr style="border-bottom: 1px solid '+design.statusbordercolor+';" >'
					+ '<td>'
						+ '<div><span style="font-weight: bold;">Message</span><br>'+'<span style="font-style: italic;">Varies</span></div>' 
					+ '</td>' 
					+ '<td width="32px" height="32px">' 
						+ '<a style= "width: 16px; height: 16px; border: 1px solid '+design.statusbordercolor+'; border-radius: 0.2em; background: none" title="Edit Message" href="!tj -edit_multi_status '
							+ statusName + ' @ message @ ?{message} @ ' + idString
							+ '"><img src="'+design.edit_icon+'"></img></a>' 
					+ '</td>'
				+ '</tr>'
			+ '</table>' 
			+ '</div>'; 

		return content; 
			
	}; 

	/**
	 * Make the display for multi-token configuration in selecting
	 * which status to edit for the group of tokens selected.
	 */ 
	var makeMultiTokenConfig = function(tuple) {
		if (!tuple) 
			{return;}

		var content = '',
			midcontent = '',
			gstatus,
			markerdef;   

		_.each(tuple, function(e) {
			gstatus = statusExists(e.statusName);
			if (!gstatus) 
				{return;}
			markerdef = _.findWhere(statusMarkers,{name: gstatus.marker});
			midcontent += 
				'<tr style="border-bottom: 1px solid '+design.statusbordercolor+';" >'
					+ (markerdef ? ('<td width="21px" height="21px">'
						+ '<div style="width: 21px; height: 21px;"><img src="'+markerdef.img+'"></img></div>'
					+ '</td>'):'<td width="0px" height="0px"></td>')
					+ '<td>'
						+ e.statusName
					+ '</td>'
					+ '<td width="32px" height="32px">' 
						+ '<a style="height: 16px; width: 16px; border: 1px solid '+design.statusbordercolor+'; border-radius: 0.2em; background: none" title="Edit '+e.statusName+' status" ' 
							+ 'href="!tj -dispmultistatusconfig change @ ' + e.statusName + ' @ ' + e.id
							+ '"><img src="'+design.edit_icon+'"></img></a>' 
					+ '</td>'
					+ '<td width="32px" height="32px">' 
						+ '<a style="height: 16px; width: 16px;  border: 1px solid '+design.statusbordercolor+'; border-radius: 0.2em; background: none" title="Remove '+e.statusName+' status" '
							+ 'href="!tj -dispmultistatusconfig remove @ ' + e.statusName + ' @ ' + e.id
							+ '"><img src="'+design.delete_icon+'"></img></a>' 
					+ '</td>'
				+ '</tr>'; 
		});

		if ('' === midcontent) {
			midcontent = '<span style="font-style: italic;">No Status Effects Present</span>'; 
		}

		content += '<div style="background-color: '+design.statuscolor+'; border: 2px solid #000; box-shadow: rgba(0,0,0,0.4) 3px 3px; border-radius: 0.5em; text-align: center;">'
			+ '<div style="border-bottom: 2px solid black; font-size: 125%; font-weight: bold; ">'
				+ 'Edit Status Group'
			+ '</div>'
			+ '<div style="border-bottom: 2px solid black; font-size: 75%; ">'
				+ '<span style="color: red; font-weight: bold;">Warning: </span> Changing a status across multiple tokens will change the status for <b><u><i>all selected</i></u></b> tokens.'
			+ '</div>'
			+ '<table width="100%">';
		content += midcontent; 
		content += '</table></div>'; 
		return content; 
	}; 

	/**
	 * Build marker selection display
	 */ 
	var makeMarkerDisplay = function(statusName,favored,custcommand) {
		var markerList = '',
			takenList = '',
			command,
			taken,
			content;   

		_.each(statusMarkers,function(e) {
			if (!favored)
				{command = (!custcommand ? ('!tj -marker ' + e.name + ' %% ' + statusName) : (custcommand+e.name));}
			else
				{command = (!custcommand ? ('!tj -marker ' + e.name + ' %% ' + statusName + ' %% ' + 'fav') : (custcommand+e.name));}
			//n*m is evil
			if (!favored && (taken = _.findWhere(state.trackerjacker.statuses,{marker: e.name}))) {
				takenList += '<div style="float: left; padding: 1px 1px 1px 1px; width: 25px; height: 25px;">' 
					+ '<span class="showtip tipsy" title="'+taken.name+'" style="width: 21px; height: 21px"><img style="text-align: center;" src="'+e.img+'"></img></span>'
					+'</div>';
			} else {
				markerList += '<div style="float: left; padding: 1px 1px 1px 1px; width: 25px; height: 25px;">' 
					+ '<a style="font-size: 0px; background: url('+e.img+') center center no-repeat; width: 21px; height: 21px" href="'+command+'"><img style="text-align: center;" src="'+e.img+'"></img></a>'
					+'</div>';	  
			}
		});
		content = '<div style="font-weight: bold; background-color: #FFF; border: 2px solid #000; box-shadow: rgba(0,0,0,0.4) 3px 3px; border-radius: 0.5em; margin-left: 2px; margin-right: 2px; padding-top: 5px; padding-bottom: 5px;">'
					+ '<div style="text-align: center;  border-bottom: 2px solid black;">'
						+ '<span style="font-weight: bold; font-size: 125%">Available Markers</span>'
					+ '</div>'
					+ '<div style="padding-left: 1px; padding-right: 1px; overflow: hidden;">'
						+ markerList
						+'<div style="clear:both;"></div>'
					+ '</div>'
					+ (takenList ? ('<br>'
						+ '<div style="border-top: 2px solid black; border-bottom: 2px solid black;">'
							+ '<span style="font-weight: bold; font-size: 125%">Taken Markers</span>'
						+ '</div>'
						+ '<div style="padding-left: 1px; padding-right: 1px; overflow: hidden;">'
							+ takenList
							+'<div style="clear:both;"></div>'
						+ '</div>'):'')
				+ '</div>'; 
		
		return content;
	};
	
	/**
	 * Build status display
	 */ 
	var makeStatusDisplay = function(statusArgs) {
		var content = '',
			gstatus = statusExists(statusArgs.name),
			markerdef; 

		if (gstatus && gstatus.marker)
			{markerdef = _.findWhere(statusMarkers,{name: gstatus.marker});}
		
		content += '<div style="font-weight: bold; font-style: italic; color: '+design.statuscolor+'; background-color: '+design.statusbgcolor+'; border: 2px solid '+design.statusbordercolor
			+'; box-shadow: rgba(0,0,0,0.4) 3px 3px; border-radius: 1em; text-align: center;">'
			+ '<table width="100%">' 
			+ '<tr>'
			+ (markerdef ? ('<td><div style="width: 21px; height: 21px;"><img src="'+markerdef.img+'"></img></div></td>'):'')
			+ '<td width="100%">'+statusArgs.name + ' ' + (parseInt(statusArgs.direction) === 0 ? '': (parseInt(statusArgs.duration) <= 0 ? '<span style="color: red;">Expiring</span>':statusArgs.duration))
			+ (parseInt(statusArgs.direction)===0 ? '<span style="color: blue;">∞</span>' : (parseInt(statusArgs.direction) > 0 ? '<span style="color: green;">▲(+'+statusArgs.direction+')</span>':'<span style="color: red;">▼('+statusArgs.direction+')</span>'))
			+ ((statusArgs.msg) ? ('<br><span style="color: #000">' + getFormattedRoll(statusArgs.msg) + '</span>'):'')+'</td>'
			+ '</tr>' 
			+ '</table>'
			+ '</div>'; 
		return content;
	};
	
	/**
	 * Build round display
	 */ 
	var makeRoundDisplay = function(round) {
		if (!round) 
			{return;}
		var content = '';
		
		content += '<div style="padding: 10px 10px 10px 10px; text-shadow: 1px 1px 2px #000, 0px 0px 1em #FFF, 0px 0px 0.2em #FFF, 1px 1px 1px #FFF; font-style: normal; font-size: 150%; font-weight: bold; color: #FFF; background-color: '+design.roundcolor+'; border: 3px solid #FFF; box-shadow: rgba(0,0,0,0.4) 3px 3px; border-radius: 2em; text-align: center;">'
			+ 'Round ' + round
			+'</div>';
		return content;
	};

	/**
	 * Build turn display
	 */ 
	var makeTurnDisplay = function(curToken) {
		if (!curToken) 
			{return;}

		var content = '', 
			journal, 
			name, 
			player,
			controllers = getTokenControllers(curToken);  

		if ((journal = getObj('character',curToken.get('represents')))) {
			name = characterObjExists('name','attribute',journal.get('_id')); 
			if (name) 
				{name = name.get('current');}
			else if (curToken.get('showplayers_name')) 
				{name = curToken.get('name');}
			else 
				{name = journal.get('name');}
		} else if (curToken.get('showplayers_name')) {
			name = curToken.get('name');
		}
		
		content += '<div style="background-color: '+design.turncolor+'; font-weight: bold; font-style: italic; border: 2px solid #000; box-shadow: rgba(0,0,0,0.4) 3px 3px; border-radius: 0.5em; text-align: center; min-height: 50px;">'
				+ '<table width="100%">'
				+ '<tr>'
				+ '<td width="50px" height="50px"><div style="margin-right 2px; padding-top: 2px; padding-bottom: 2px; padding-left: 2px; padding-right: 2px; text-align: center; width: 50px">' 
					+ '<img width="50px" height="50px" src="' + curToken.get('imgsrc') + '"></img></div></td>'
				+ '<td width="100%">' 
					+ (name ? ('It is ' + name + '\'s turn') : 'Turn') 
				+ '</td>'
				+ '<td width="32px" height="32px">'
					+ '<a style="width: 20px; height: 18px; background: none; border: none;" href="!tj -disptokenconfig '+curToken.get('_id')+'"><img src="'+design.settings_icon+'"></img></a>'
				+ '</td>'
				+ '</tr>';
		
		if (_.find(controllers,function(e){return (e === 'all');})) {
			content += '<tr>'
				+ '<td colspan="3"><div style="margin-left: -2px; font-style: normal; font-weight: bold; font-size: 125%; text-shadow: -1px -1px 1px #FFF, 1px -1px 1px #FFF, -1px 1px 1px #FFF, 1px 1px 1px #FFF; color #FFF; border: 2px solid #000; width: 100%; background-color: #FFF;">All Players</div></td>'
				+ '</tr>';
		} else {
			_.each(controllers,function(e) {
				player = getObj('player',e);
				if (player) {
					content += '<tr>'
						+ '<td colspan="3"><div style="margin-left: -2px; font-style: normal; font-weight: bold; font-size: 125%; text-shadow: -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000, 1px 1px 1px #000; color: #FFF; border:2px solid #000; width: 100%; background-color: ' + player.get('color') + ';">' + player.get('displayname') + '</div></td>'
						+ '</tr>';
				}
			});
		}
		content += '</table>'
				+ "</div>";
		
		return content;
	};

	/**
	 * Build a listing of favorites with buttons that allow them
	 * to be applied to a selection.
	 */
	var makeFavoriteConfig = function() {
		var midcontent = '',
			content = '',
			markerdef; 

		_.each(state.trackerjacker.favs,function(e) {
			markerdef = _.findWhere(statusMarkers,{name: e.marker});
			midcontent += 
				'<tr style="border-bottom: 1px solid '+design.statusbordercolor+';" >'
					+ (markerdef ? ('<td width="21px" height="21px">'
						+ '<div style="width: 21px; height: 21px;"><img src="'+markerdef.img+'"></img></div>'
					+ '</td>'):'<td width="0px" height="0px"></td>')
					+ '<td>'
						+ e.name
					+ '</td>'
					+ '<td width="32px" height="32px">' 
						+ '<a style="height: 16px; width: 16px;  border: 1px solid '+design.statusbordercolor+'; border-radius: 0.2em; background: none" title="Apply '+e.name+' status" href="!tj -applyfav '
							+ e.name
							+ '"><img src="'+design.apply_icon+'"></img></a>' 
					+ '</td>'
					+ '<td width="32px" height="32px">' 
						+ '<a style="height: 16px; width: 16px; border: 1px solid '+design.statusbordercolor+'; border-radius: 0.2em; background: none" title="Edit '+e.name+' status" href="!tj -dispstatusconfig '
							+ ' %% changefav %% '+e.name
							+ '"><img src="'+design.edit_icon+'"></img></a>' 
					+ '</td>'
					+ '<td width="32px" height="32px">' 
						+ '<a style="height: 16px; width: 16px;  border: 1px solid '+design.statusbordercolor+'; border-radius: 0.2em; background: none" title="Remove '+e.name+' status" href="!tj -dispstatusconfig '
							+ ' %% removefav %% '+e.name
							+ '"><img src="'+design.delete_icon+'"></img></a>' 
					+ '</td>'
				+ '</tr>'; 
		});

		if ('' === midcontent)
			{midcontent = 'No Favorites Available';}

		content = '<div style="background-color: '+design.statuscolor+'; border: 2px solid #000; box-shadow: rgba(0,0,0,0.4) 3px 3px; border-radius: 0.5em; text-align: center;">'
			+ '<div style="font-weight: bold; font-size: 125%; border-bottom: 2px solid black;">'
				+ 'Favorites'
			+ '</div>'
			+ '<table width="100%">'; 
		content += midcontent; 
		content += '</table></div>'; 

		return content; 
	};

	/**
	 * Build a settings dialog given a token that has effects upon it.
	 */ 
	var makeStatusConfig = function(curToken, statusName, favored) {
		if (!statusName || (!curToken && !favored)) {
			return '<span style="color: red; font-weight: bold;">Invalid syntax</span>'; 
		}
		var globalStatus = statusExists(statusName),
			effects = getStatusEffects(curToken),
			status = _.findWhere(effects,{name:statusName}),
			mImg,
			content = ''; 

		if (!favored && (!status || !globalStatus)) {
			return '<span style="color: red; font-weight: bold;">Invalid syntax</span>'; 
		}

		if (favored) {
			status=favored;
			globalStatus=favored;
		}
		
		if (!globalStatus || !status) {
			return '<span style="color: red; font-weight: bold;">Status does not exist internally</span>'; 
		}

		mImg = _.findWhere(statusMarkers,{name: globalStatus.marker}); 
		if (mImg) 
			{mImg = '<img src="' + mImg.img + '"></img>';}
		else
			{mImg = 'none';}

		content += '<div style="background-color: '+design.statuscolor+'; border: 2px solid #000; box-shadow: rgba(0,0,0,0.4) 3px 3px; border-radius: 0.5em; text-align: center;">'
			+ '<div style="border-bottom: 2px solid black;">'
				+ '<table width="100%"><tr><td width="100%"><span style="font-weight: bold; font-size: 125%">'+ (favored ? 'Edit Favorite' :('Edit "'+statusName+'" for'))+'</span></td>'+(favored ? ('<td width="100%">'+statusName+'</td>') : ('<td width="32px" height="32px"><div style="width: 32px; height: 32px"><img src="'+curToken.get('imgsrc')+'"></img></div></td>')) + '</tr></table>'
			+ '</div>'
			+ '<table width="100%">' 
				+ '<tr style="background-color: #FFF; border-bottom: 1px solid '+design.statusbordercolor+';" >'
					+ '<td>'
						+ '<div><span style="font-weight: bold;">Name</span><br>'+'<span style="font-style: italic;">'+statusName+'</span></div>' 
					+ '</td>' 
					+ '<td width="32px" height="32px">' 
						+ '<a style= "width: 16px; height: 16px; border: 1px solid '+design.statusbordercolor+'; border-radius: 0.2em; background: none" title="Edit Name" href="!tj -edit_status '
							+ (favored ? 'changefav':'change')+' %% ' + (favored ? (''):(curToken.get('_id'))) +' %% '+statusName+' %% name %% ?{name|'+statusName+'}' 
							+ '"><img src="'+design.edit_icon+'"></img></a>' 
					+ '</td>'
				+ '</tr>' 
				+ '<tr style="background-color: #FFF; border-bottom: 1px solid '+design.statusbordercolor+';" >'
					+ '<td>'
						+ '<div><span style="font-weight: bold;">Marker</span><br>'+'<span style="font-style: italic;">'+mImg+'</span></div>' 
					+ '</td>' 
					+ '<td width="32px" height="32px">' 
						+ '<a style= "width: 16px; height: 16px; border: 1px solid '+design.statusbordercolor+'; border-radius: 0.2em; background: none" title="Edit Marker" href="!tj -edit_status '
							+ (favored ? 'changefav':'change')+' %% ' + (favored ? (''):(curToken.get('_id'))) +' %% '+statusName+' %% marker %% mark' 
							+ '"><img src="'+design.edit_icon+'"></img></a>' 
					+ '</td>'
				+ '</tr>' 
				+ '<tr style="border-bottom: 1px solid '+design.statusbordercolor+';" >'
					+ '<td>'
						+ '<div><span style="font-weight: bold;">Duration</span><br>'+'<span style="font-style: italic;">'+status.duration+'</span></div>' 
					+ '</td>' 
					+ '<td width="32px" height="32px">' 
						+ '<a style= "width: 16px; height: 16px; border: 1px solid '+design.statusbordercolor+'; border-radius: 0.2em; background: none" title="Edit Duration" href="!tj -edit_status '
							+ (favored ? 'changefav':'change')+' %% ' + (favored ? (''):(curToken.get('_id'))) +' %% '+statusName+' %% duration %% ?{duration|'+status.duration+'}' 
							+ '"><img src="'+design.edit_icon+'"></img></a>' 
					+ '</td>'
				+ '</tr>' 
				+ '<tr style="border-bottom: 1px solid '+design.statusbordercolor+';" >'
					+ '<td>'
						+ '<div><span style="font-weight: bold;">Direction</span><br>'+'<span style="font-style: italic;">'+status.direction+'</span></div>' 
					+ '</td>' 
					+ '<td width="32px" height="32px">' 
						+ '<a style= "width: 16px; height: 16px; border: 1px solid '+design.statusbordercolor+'; border-radius: 0.2em; background: none" title="Edit Direction" href="!tj -edit_status '
							+ (favored ? 'changefav':'change')+' %% ' + (favored ? (''):(curToken.get('_id'))) +' %% '+statusName+' %% direction %% ?{direction|'+status.direction+'}' 
							+ '"><img src="'+design.edit_icon+'"></img></a>' 
					+ '</td>'
				+ '</tr>'
				+ '<tr style="border-bottom: 1px solid '+design.statusbordercolor+';" >'
					+ '<td>'
						+ '<div><span style="font-weight: bold;">Message</span><br>'+'<span style="font-style: italic;">'+status.msg+'</span></div>' 
					+ '</td>' 
					+ '<td width="32px" height="32px">' 
						+ '<a style= "width: 16px; height: 16px; border: 1px solid '+design.statusbordercolor+'; border-radius: 0.2em; background: none" title="Edit Message" href="!tj -edit_status '
							+ (favored ? 'changefav':'change')+' %% ' + (favored ? (''):(curToken.get('_id'))) +' %% '+statusName+' %% message %% ?{message|'+status.msg+'}' 
							+ '"><img src="'+design.edit_icon+'"></img></a>' 
					+ '</td>'
				+ '</tr>'
				+ (favored ? '':('<tr>'
					+ '<td colspan="2">'
						//+ '<a href="!CreatureGen -help">cookies</a>' 
						//+ '<a style="font-weight: bold" href="!tj -addfav '+statusName+' %% '+status.duration+' %% '+status.direction+' %% '+status.msg+' %% '+globalStatus.marker+'"> Add to Favorites</a>'
						+ TrackerJacker_tmp.getTemplate({command: '!tj -addfav '+statusName+' %% '+status.duration+' %% '+status.direction+' %% '+status.msg+' %% '+globalStatus.marker, text: 'Add to Favorites'},'button')

					+ '</td>' 
				+ '</tr>'))
			+ '</table>' 
			+ '</div>'; 

		return content; 
		
	}; 

	/**
	 * Build the token dialog to display statuses effecting it
	 */
	var makeTokenConfig = function(curToken) {
		if (!curToken) 
			{return;}

		var content = '',
			midcontent = '',
			gstatus,
			markerdef,
			effects = getStatusEffects(curToken); 

		_.each(effects, function(e) {
			gstatus = statusExists(e.name);
			if (!gstatus) 
				{return;}
			markerdef = _.findWhere(statusMarkers,{name: gstatus.marker});
			midcontent += 
				'<tr style="border-bottom: 1px solid '+design.statusbordercolor+';" >'
					+ (markerdef ? ('<td width="21px" height="21px">'
						+ '<div style="width: 21px; height: 21px;"><img src="'+markerdef.img+'"></img></div>'
					+ '</td>'):'<td width="0px" height="0px"></td>')
					+ '<td>'
						+ e.name
					+ '</td>'
					+ '<td width="32px" height="32px">' 
						+ '<a style="height: 16px; width: 16px; border: 1px solid '+design.statusbordercolor+'; border-radius: 0.2em; background: none" title="Edit '+e.name+' status" href="!tj -dispstatusconfig '
							+ curToken.get('_id')+' %% change %% '+e.name
							+ '"><img src="'+design.edit_icon+'"></img></a>' 
					+ '</td>'
					+ '<td width="32px" height="32px">' 
						+ '<a style="height: 16px; width: 16px;  border: 1px solid '+design.statusbordercolor+'; border-radius: 0.2em; background: none" title="Remove '+e.name+' status" href="!tj -dispstatusconfig '
							+ curToken.get('_id')+' %% remove %% '+e.name
							+ '"><img src="'+design.delete_icon+'"></img></a>' 
					+ '</td>'
				+ '</tr>'; 
		});

		if ('' === midcontent) {
			midcontent += '<tr><td><div style="text-align: center; font-style: italic;">No Status Effects Present</div></td></tr>'; 
		}
		
		content += '<div style="background-color: '+design.statuscolor+'; border: 2px solid #000; box-shadow: rgba(0,0,0,0.4) 3px 3px; border-radius: 0.5em; text-align: center;">'
			+ '<div style="border-bottom: 2px solid black;">'
				+ '<table width="100%"><tr><td width="100%"><span style="font-weight: bold; font-size: 125%">Statuses for</span></td><td width="32px" height="32px"><div style="width: 32px; height: 32px"><img src="'+curToken.get('imgsrc')+'"></img></div></td></tr></table>'
			+ '</div>'
			+ '<table width="100%">';
		content += midcontent; 
		content += '</table>'; 
		content += /*'<div style="border-top: 1px solid black;">'
					+ '<a style="font-weight: bold" href="!tj -addstatus ?{name}:?{duration}:?{direction}:?{message}"> Add Status</a>'
					+ '<br><a style="font-weight: bold" href="!tj -listfavs"> Apply Favorite</a>'
				+ '</div>'+*/'</div>'; 
		return content;
	}; 

	/**
	 * Show a listing of markers
	 */
	var doShowMarkers = function() {
		var disp = makeMarkerDisplay();
		sendFeedback(disp);
	}; 

	/**
	 * Is a tracker
	 */
	var isTracker = function(turn) {
		if (parseInt(turn.id) === -1 
		&& parseInt(turn.pr) === -100
		&& turn.custom.match(/Round\s*\d+/))
			{return true;}
		return false;
	};
	
	/**
	 * Get the graphic object for the tracker (if any) for the current page.
	 * If it does not exist, create it. Avoid creating a duplicate where possible
	 */
	var findTrackerGraphic = function(pageid) { 
		var graphic = getObj('graphic',fields.trackerId),
			curToken = findCurrentTurnToken(); 
		
		pageid = (pageid ? pageid : (curToken ? curToken.get('_pageid') : Campaign().get('playerpageid'))); 
		
		if (graphic && graphic.get('_pageid') === pageid) {
			return graphic;
		} else {
			// we find the graphic
			var cannidates = findObjs({
				_pageid: pageid,
				_type: 'graphic',
				name: fields.trackerName,
			});
			if (cannidates && cannidates[0]) {
				graphic = cannidates[0];
				fields.trackerId = graphic.get('_id');
				return graphic;
			} else {
				// we make the graphic
				graphic = createObj('graphic', {
					_type: 'graphic',
					_subtype: 'token',
					_pageid: pageid,
					name: fields.trackerName,
					imgsrc: fields.trackerImg,
					layer: 'gmlayer',
					width: 70,
					height: 70,
				});
				fields.trackerId = graphic.get('_id');
				return graphic;
			}
		}
		
	};
	
	/**
	 * Find the current token at the top of the tracker if any
	 */ 
	var findCurrentTurnToken = function(turnorder) {
		if (!turnorder) 
			{turnorder = Campaign().get('turnorder');}
		if (!turnorder) 
			{return undefined;}
		if (typeof(turnorder) === 'string') 
			{turnorder = JSON.parse(turnorder);}
		if (turnorder && turnorder.length > 0 && turnorder[0].id !== -1)
			{return getObj('graphic',turnorder[0].id);}
		return;
	};
	
	/**
	 * Announce the round
	 */
	var announceRound = function(round) {
		if (!round) 
			{return;} 
		var disp = makeRoundDisplay(round);
		sendPublic(disp);
	};
	
	/**
	 * Announce the turn with an optional rider display
	 */
	var announceTurn = function(curToken,statusRiders) {
		if (!curToken) 
			{return;}
		var disp = makeTurnDisplay(curToken);
		disp += statusRiders.public;
		if (curToken.get('layer') !== 'objects') {
			disp += statusRiders.hidden; 
			sendFeedback(disp);
		} else {
			sendPublic(disp);
			if (statusRiders.hidden)
				{sendFeedback(statusRiders.hidden);}
		}
	}; 
	
	/**
	 * Handle the turn order advancement given the current and prior ordering
	 */
	var handleAdvanceTurn = function(turnorder,priororder) {
		if (flags.tj_state === TJ_StateEnum.STOPPED || flags.tj_state === TJ_StateEnum.PAUSED || !turnorder || !priororder) 
			{return;}
		if (typeof(turnorder) === 'string') 
			{turnorder = JSON.parse(turnorder);}
		if (typeof(priororder) === 'string') 
			{priororder = JSON.parse(priororder);}
		var currentTurn = turnorder[0];
		
		if (currentTurn) {
			if (turnorder.length > 1
			&& isTracker(currentTurn)) {
				// ensure that last turn we weren't also atop the order
				if (!priororder || isTracker(priororder[0])) 
					{return;}
				var rounds = parseInt(currentTurn.custom.match(/\d+/)[0]);
				rounds++;
				currentTurn.custom = currentTurn.custom.substring(0,currentTurn.custom.indexOf('Round')) 
					+ 'Round ' + rounds;
				announceRound(rounds);
				turnorder.shift();
				turnorder.push(currentTurn);
				currentTurn = turnorder[0];
				updateTurnorderMarker(turnorder);
			}
			if (currentTurn.id !== -1 
				&& priororder
				&& priororder[0].id !== currentTurn.id) {
					var graphic,
						curToken = getObj('graphic',currentTurn.id),
						priorToken = getObj('graphic',priororder[0].id),
						maxsize = 0;
					if (!curToken) 
						{return;}

					if (priorToken && priorToken.get('_pageid') !== curToken.get('_pageid')) {	
						graphic = findTrackerGraphic(priorToken.get('_pageid')); 
						graphic.set('layer','gmlayer');
					}
					graphic = findTrackerGraphic(); 

					if (flags.tj_state === TJ_StateEnum.ACTIVE)
						{flags.tj_state = TJ_StateEnum.FROZEN;}
					maxsize = Math.max(parseInt(curToken.get('width')),parseInt(curToken.get('height')));
					graphic.set('layer','gmlayer');
					graphic.set('left',curToken.get('left'));
					graphic.set('top',curToken.get('top'));
					graphic.set('width',parseFloat(maxsize*fields.trackerImgRatio));
					graphic.set('height',parseFloat(maxsize*fields.trackerImgRatio));
					toFront(curToken); 
					setTimeout(function() {
						if (graphic) {
							if (curToken.get('layer') === 'gmlayer') {
								graphic.set('layer','gmlayer');
								toBack(graphic);
							} else {
								graphic.set('layer','map');
								toFront(graphic);
							}
							if (flags.tj_state === TJ_StateEnum.FROZEN)
								{flags.tj_state = TJ_StateEnum.ACTIVE;}
						}
					},500);
					// Manage status
					// Announce Turn
					announceTurn(curToken,updateStatusDisplay(curToken));
			}
		}
		
		turnorder = JSON.stringify(turnorder);
		Campaign().set('turnorder',turnorder);
	};

	/**
	 * Check if a favorite status exists
	 */
	var favoriteExists = function(statusName) {
		statusName = statusName.toLowerCase(); 
		var found = _.find(_.keys(state.trackerjacker.favs), function(e) {
			return e === statusName; 
		});
		if (found)
			{found = state.trackerjacker.favs[found]; }
		return found; 
	}; 

	/**
	 * Produce a listing of favorites
	 */
	var doApplyFavorite = function(statusName,selection) {
		if (!statusName) 
			{return;}
		statusName = statusName.toLowerCase(); 

		var fav = favoriteExists(statusName),
			markerdef, 
			curToken,
			effectId,
			effectList,
			status,
			content = '',
			midcontent = ''; 

		if (!fav) {
			sendError('<b>"'+statusName+'"</b> is not a known favorite status');
			return; 
		}

		var markerUsed = _.find(state.trackerjacker.statuses, function(e) {
			if (typeof(e.marker) !== 'undefined' 
			&& e.marker === fav.marker
			&& e.name !== fav.name)
				{return true;}
		});

		if (markerUsed) {
			markerdef = _.findWhere(statusMarkers,{name: markerUsed.marker});
			sendError('Status <i>"'+markerUsed.name+'"</i> already uses marker <img src="'+markerdef.img+'"></img>. You can either change the marker for favorite <i>"'+statusName+'"</i> or the marker for <i>"'+markerUsed.name+'"</i>');
			return; 
		}

		markerdef = _.findWhere(statusMarkers,{name: fav.marker});

		_.each(selection,function(e) {
			curToken = getObj('graphic', e._id);
			if (!curToken || curToken.get('_subtype') !== 'token' || curToken.get('isdrawing'))
				{return;}
			effectId = e._id;
			effectList = state.trackerjacker.effects[effectId];
			
			if ((status = _.find(effectList,function(elem) {return elem.name.toLowerCase() === fav.name.toLowerCase();}))) {
				return;
			} else if (effectList && Array.isArray(effectList)) {
				effectList.push({
					name: fav.name,
					duration: fav.duration,
					direction: fav.direction,
					msg: fav.msg,
				});
				updateGlobalStatus(fav.name,undefined,1);
			} else {
				state.trackerjacker.effects[effectId] = effectList = new Array({
					name: fav.name,
					duration: fav.duration,
					direction: fav.direction,
					msg: fav.msg,
				});
				updateGlobalStatus(fav.name,undefined,1);
			}
			midcontent += '<div style="width: 40px; height 40px; display: inline-block;"><img src="'+curToken.get('imgsrc')+'"></div>';
		});

		if ('' === midcontent)
			{midcontent = '<div style="font-style: italic; text-align: center; font-size: 125%; ">None</div>';}

		content += '<div style="font-weight: bold; background-color: '+design.statusbgcolor+'; border: 2px solid #000; box-shadow: rgba(0,0,0,0.4) 3px 3px; border-radius: 0.5em;">'
			+ '<div style="text-align: center; color: '+design.statuscolor+'; border-bottom: 2px solid black;">'
					+ '<span style="font-weight: bold; font-size: 120%">Apply Favorite</span>'
				+ '</div>'
			+ 'Name: ' + '<span style="color:'+design.statuscolor+';">'+fav.name+'</span>'
			+ '<br>Marker: ' + (markerdef ? ('<img src="'+markerdef.img+'"></img>'):'none')
			+ '<br>Duration: ' + fav.duration
			+ '<br>Direction: ' + fav.direction + (fav.msg ? ('<br>Message: ' + fav.msg):'')
			+ '<br><br><span style="font-style: normal;">Status placed on the following:</span><br>' ;

		content += midcontent; 
		
		status = statusExists(fav.name.toLowerCase()); 
		if (status && !status.marker && fav.marker)
			{doDirectMarkerApply(markerdef.name+' %% '+fav.name); }
		else if (status && !status.marker)
			{content += '<br><div style="text-align: center;">'+TrackerJacker_tmp.getTemplate({command: '!tj -dispmarker '+fav.name, text: 'Choose Marker'},'button')+'</div>';}

		updateAllTokenMarkers(); 
		content += '</div>'; 
		sendFeedback(content);
	}; 

	/**
	 * Add a favorite status to the list of statuses
	 */
	var doAddFavorite = function(args) {
		if (!args) 
			{return;}

		args = args.split(/:| %% /);

		if (args.length < 3 || args.length > 5) {
			sendError('Invalid favorite status syntax');
			return;
		}

		var name = args[0],
			duration = parseInt(args[1]),
			direction = parseInt(args[2]),
			msg = args[3],
			marker = args[4],
			markerdef;  

		if (typeof(name) === 'string')
			{name = name.toLowerCase();}

		if (isNaN(duration) || isNaN(direction)) {
			sendError('Invalid favorite status syntax');
			return;
		}

		if (marker && !_.findWhere(statusMarkers,{name: marker})) {
			marker = undefined; 
		} else {
			markerdef = _.findWhere(statusMarkers,{name: marker});
		}

		if (favoriteExists(name)) {
			sendError('Favorite with the name "'+name+'" already exists');
			return; 
		}

		var newFav = {
			name: name,
			duration: duration,
			direction: direction,
			msg: msg,
			marker: marker
		};

		state.trackerjacker.favs[name] = newFav; 

		var content = '<div style="font-weight: bold; background-color: '+design.statusbgcolor+'; border: 2px solid #000; box-shadow: rgba(0,0,0,0.4) 3px 3px; border-radius: 0.5em;">'
			+ '<div style="text-align: center; color: '+design.statuscolor+'; border-bottom: 2px solid black;">'
					+ '<span style="font-weight: bold; font-size: 120%">Add Favorite</span>'
			+ '</div>'
			+ 'Name: ' + '<span style="color:'+design.statuscolor+';">'+name+'</span>'
			+ '<br>Marker: ' + (markerdef ? ('<img src="'+markerdef.img+'"></img>'):'none')
			+ '<br>Duration: ' + duration
			+ '<br>Direction: ' + direction 
			+ (msg ? ('<br>Message: ' + msg):'')
			+ (marker ? '':('<br><div style="text-align: center;">'+TrackerJacker_tmp.getTemplate({command: '!tj -dispmarker '+name+ ' %% fav', text: 'Choose Marker'},'button')+'</div>')); 
		content += '</div>'; 

		sendFeedback(content); 

	};

	/**
	 * Remove a favorite from the tracker
	 */
	var doRemoveFavorite = function(statusName) {
		if (!statusName) 
			{return;}
		statusName = statusName.toLowerCase(); 

		if (!favoriteExists(statusName)) {
			sendFeedback('Status "' + statusName + '" is not on the favorite list');
			return; 
		}

		var content = '<div style="font-weight: bold; background-color: '+design.statusbgcolor+'; border: 2px solid #000; box-shadow: rgba(0,0,0,0.4) 3px 3px; border-radius: 0.5em;">'
			+ '<div style="text-align: center; color: '+design.statuscolor+'; border-bottom: 2px solid black;">'
					+ '<span style="font-weight: bold; font-size: 120%">Remove Favorite</span>'
			+ '</div>'
			+ 'Favorite ' + '<span style="color:'+design.statuscolor+';">'+statusName+'</span> removed.'
			+ '</div>'; 

		delete state.trackerjacker.favs[statusName]; 
		sendFeedback(content); 

		
	}; 

	/**
	 * Add turn item
	 */
	var doAddStatus = function(args,selection) {
		if (!args) 
			{return;}
		if (!selection) {
			sendError('Invalid selection');
			return;
		}
		
		args = args.split(':');
		
		if (args.length <3 || args.length > 5) {
			sendError('Invalid status item syntax');
			return;
		}
		var name = args[0],
			duration = parseInt(args[1]),
			direction = parseInt(args[2]),
			msg = args[3],
			marker = args[4];

		if (marker === 'undefined')
			{marker = false;}

		if (typeof(name) === 'string')
			{name = name.toLowerCase();}

		if (isNaN(duration) || isNaN(direction) || !name) {
			sendError('Invalid status item syntax');
			return;
		}

		if (marker && (!_.find(statusMarkers, function(e) { return e.name === marker; }) 
		|| !!_.find(state.trackerjacker.statuses, function(e) {return e.name === e.marker;}))) {
			sendError('Marker invalid or already in use'); 
			return; 
		}
		
		var curToken,
			effectId,
			effectList,
			status,
			content = '',
			midcontent = '';

		_.each(selection,function(e) {
			curToken = getObj('graphic', e._id);
			if (!curToken || curToken.get('_subtype') !== 'token' || curToken.get('isdrawing'))
				{return;}
			effectId = e._id;
			effectList = state.trackerjacker.effects[effectId];
			
			if ((status = _.find(effectList,function(elem) {return elem.name.toLowerCase() === name.toLowerCase();}))) {
				return;
			} else if (effectList && Array.isArray(effectList)) {
				effectList.push({
					name: name,
					duration: duration,
					direction: direction,
					msg: msg
				});
				updateGlobalStatus(name,undefined,1);
			} else {
				state.trackerjacker.effects[effectId] = effectList = new Array({
					name: name,
					duration: duration,
					direction: direction,
					msg: msg
				});
				updateGlobalStatus(name,undefined,1);
			}
			midcontent += '<div style="width: 40px; height 40px; display: inline-block;"><img src="'+curToken.get('imgsrc')+'"></div>'; 
		});

		if ('' === midcontent)
			{midcontent = '<div style="font-style: italic; text-align: center; font-size: 125%; ">None</div>';}


		content += '<div style="font-weight: bold; background-color: '+design.statusbgcolor+'; border: 2px solid #000; box-shadow: rgba(0,0,0,0.4) 3px 3px; border-radius: 0.5em;">'
			+ '<div style="text-align: center; color: '+design.statuscolor+'; border-bottom: 2px solid black;">'
					+ '<span style="font-weight: bold; font-size: 120%">Add Status</span>'
				+ '</div>'
			+ 'Name: ' + '<span style="color:'+design.statuscolor+';">'+name+'</span>'
			+ '<br>Duration: ' + duration
			+ '<br>Direction: ' + direction + (msg ? ('<br>Message: ' + msg):'')
			+ '<br><br><span style="font-style: normal;">Status placed on the following:</span><br>' ;
		content += midcontent; 

		status = statusExists(name.toLowerCase()); 
		if (status && !status.marker) {
			if (marker)
				{status.marker = marker;}
			else
				{content += '<br><div style="text-align: center;">'+TrackerJacker_tmp.getTemplate({command: '!tj -dispmarker '+name, text: 'Choose Marker'},'button')+'</div>';}
		}

		content += '</div>'; 
		updateAllTokenMarkers(); 
		sendFeedback(content);
	};
	
	/**
	 * Remove a status from the selected tokens
	 */
	var doRemoveStatus = function(args,selection) {
		if (!args || !selection) {
			sendError('Invalid selection');
			return;
		}
		var effects,
			found = false,
			toRemove = [],
			curToken,
			effectId,
			removedStatus,
			content = '',
			midcontent = ''; 

		args = args.toLowerCase();
		
		_.each(selection, function(e) {
			effectId = e._id;
			curToken = getObj('graphic', e._id);
			if (!curToken || curToken.get('_subtype') !== 'token' || curToken.get('isdrawing'))
				{return;}
			effects = state.trackerjacker.effects[effectId];
			effects = _.reject(effects,function(elem) {
				if (elem.name.toLowerCase() === args) {
					found = true;
					midcontent += '<div style="width: 40px; height 40px; display: inline-block;"><img src="'+curToken.get('imgsrc')+'"></div>'; 
					removedStatus = updateGlobalStatus(elem.name,undefined,-1);
					return true;
				}
				return false;
			});
			setStatusEffects(curToken,effects);
			toRemove.push(removedStatus); 
			// Remove markers
		});

		if ('' === midcontent)
			{midcontent = '<div style="font-style: italic; text-align: center; font-size: 125%; ">None</div>';}


		content += '<div style="font-weight: bold; background-color: '+design.statusbgcolor+'; border: 2px solid #000; box-shadow: rgba(0,0,0,0.4) 3px 3px; border-radius: 0.5em;">'
			+ '<div style="text-align: center; color: '+design.statuscolor+'; border-bottom: 2px solid black;">'
				+ '<span style="font-weight: bold; font-size: 120%">Remove Status</span>'
			+ '</div>'
			+ '<span style="font-style: normal;">Status "<span style="color: '+design.statuscolor+';">' +args+'</span>" removed from the following:</span><br>';
		content += midcontent; 
		content += '</div>'; 
		if (!found)
			{content = '<span style="color: red; font-weight:bold;">No status "' + args + '" exists on any in the selection</span>'; }
		updateAllTokenMarkers(toRemove); 
		sendFeedback(content);
	};

	/**
	 * Display marker list (internally used)
	 */
	var doDisplayMarkers = function(args) {
		if (!args) 
			{return;}
		args = args.toLowerCase(); 
		args = args.split(' %% '); 
		var statusName = args[0],
			isfav = args[1],
			content = ''; 

		if (!isfav && !statusExists(statusName)) 
			{return;}

		content = makeMarkerDisplay(statusName,(isfav === 'fav'));
		sendFeedback(content); 	
	}; 

	/**
	 * Display token configuration (internally used)
	 */
	var doDisplayTokenConfig = function(args) {
		if (!args) 
			{return;} 

		var curToken = getObj('graphic',args);
		if (!curToken || curToken.get('_subtype') !== 'token') {
			sendError('Invalid target'); 
		}

		var content = makeTokenConfig(curToken); 
		sendFeedback(content); 
	}; 

	/**
	 * Display status configuration (internally used)
	 */
	var doDisplayStatusConfig = function(args) {
		if (!args) 
			{return;} 

		args = args.split(/ %% /); 
		var tokenId = args[0],
			action = args[1],
			statusName = args[2];

		// dirty fix for lack of trim()
		if (tokenId)
			{tokenId = tokenId.trim();}

		var curToken = getObj('graphic',tokenId);
		if ((tokenId && (!curToken || curToken.get('_subtype') !== 'token')) 
			|| !action 
			|| !statusName) {
			sendError('Invalid syntax'); 
			return; 
		}

		var content; 
		switch (action) {
			case 'remove':
				doRemoveStatus(statusName,[{_id: tokenId}]); 
				break;
			case 'change':
				content = makeStatusConfig(curToken,statusName); 
				sendFeedback(content); 
				break;
			case 'removefav':
				doRemoveFavorite(statusName); 
				break; 
			case 'changefav':
				content = makeStatusConfig('',statusName,favoriteExists(statusName)); 
				sendFeedback(content);
				break; 
			default:
				sendError('Invalid syntax'); 
				return; 
		}
	}; 

	/**
	 * Display favorite configuration
	 */ 
	var doDisplayFavConfig = function() {
		var content = makeFavoriteConfig(); 
		sendFeedback(content); 
	}; 

	/**
	 * Perform a single edit operation
	 */
	var doEditTokenStatus = function(selection) {
		var graphic; 
		if (!selection 
		|| selection.length !== 1 
		|| !(graphic = getObj('graphic',selection[0]._id)
		|| graphic.get('_subtype') !== 'token' )
		|| graphic.get('isdrawing')) {
			sendError('Invalid selection'); 
			return; 
		}
		var curToken = getObj('graphic',selection[0]._id);
		var content = makeTokenConfig(curToken); 
		sendFeedback(content); 
	};

	/**
	 * Display the status edit dialog for a multi edit
	 */ 
	var doDisplayMultiStatusConfig = function(args) {
		if (!args) 
			{return;} 

		args = args.split(' @ '); 

		var action = args[0],
			statusName = args[1],
			idString = args[2],
			content = ''; 

		if (action === 'remove') {
			idString = idString.split(' %% '); 
			var selection = [];
			_.each(idString, function(e) {
				selection.push({_id: e, _type: 'graphic'}); 	
			}); 
			doRemoveStatus(statusName,selection); 
			return; 
		} else if (action !== 'change') {
			return; 
		}

		content = makeMultiStatusConfig(action,statusName,idString); 

		sendFeedback(content); 

	}; 

	/**
	 * Display the multi edit token dialog
	 */ 
	var doMultiEditTokenStatus = function(selection) {
		if (!selection) 
			{return;}
		if (selection.length === 1) 
			{return doEditTokenStatus(selection);}

		var tuple = [],
			subTuple,
			curToken,
			effects,
			content;

		_.each(selection,function(e) {
			curToken = getObj('graphic',e._id);
			if(curToken && curToken.get('_subtype') === 'token' && !curToken.get('isdrawing')) {
				effects = getStatusEffects(curToken); 
				if (effects) {
					_.each(effects,function(f) {
						if (!(subTuple=_.find(tuple,function(g){return g.statusName === f.name;})))
							{tuple.push({id: e._id, statusName: f.name});}
						else
							{subTuple.id = subTuple.id + ' %% ' + e._id;} 
					}); 
				}
			}	
		});

		content = makeMultiTokenConfig(tuple); 
		sendFeedback(content); 
	};

	/**
	 * Perform the edit operation on multiple tokens whose ids
	 * are supplied. 
	 */ 
	var doEditMultiStatus = function(args) {
		if (!args) 
			{return;}

		args = args.split(' @ ');

		var statusName = args[0],
			attrName = args[1],
			newValue = args[2],
			idString = args[3],
			gstatus = statusExists(statusName),
			effectList,
			content = '',
			midcontent,
			errMsg;

		// input sanitation
		if (!newValue)
			{newValue = '';} 
		if (!statusName || !attrName) {
			sendError('Error on multi-selection'); 
			return; 
		}

		// dirty fix for lack of trim()
		statusName = statusName.toLowerCase().trim(); 
		idString = idString.trim(); 
		idString = idString.split(' %% '); 


		if (attrName === 'name') {
			if (statusExists(newValue)) {
				sendError('Status name already exists');
				return; 
			}
			gstatus = statusExists(statusName); 
			newValue = newValue.toLowerCase(); 
			effectList = state.trackerjacker.effects; 
			_.each(effectList,function(effects) {
				_.each(effects,function(e) {
					if (e.name === statusName)
						{e.name = newValue;}
				}); 
			});
			gstatus.name = newValue; 
			midcontent = 'New status name is "' + newValue + '"'; 
		} else if (attrName === 'marker') {
			content = makeMarkerDisplay(statusName); 
			sendFeedback(content); 
			return; 
		} else {
			idString = _.chain(_.keys(state.trackerjacker.effects))
				.reject(function(n) {
					return !_.contains(idString,n); 
				})
				.value(); 
			_.each(idString, function(e) {
				effectList = getStatusEffects(getObj('graphic',e)); 
				_.find(effectList,function(f) {
					if (f.name === statusName) {
						switch (attrName) {
							case 'duration':
								if (!isNaN(newValue)) {
									f.duration = parseInt(newValue); 
									if (!midcontent)
										{midcontent = 'New duration is ' + newValue;}
								} else if (!errMsg) {
									errMsg = 'Invalid Value'; 
								}
								// change duration for selected statuses
								break; 
							case 'direction': 
								if (!isNaN(newValue)) {
									f.direction = parseInt(newValue); 
									if (!midcontent)
										{midcontent = 'New direction is ' + newValue;}
								} else if (!errMsg) {
									errMsg = 'Invalid Value'; 
								}
								// change direction for selected statuses
								break; 
							case 'message': 
								f.msg = newValue;
								if (!midcontent)
									{midcontent = 'New message is ' + newValue;}
								// change message for selected statuses
								break; 
							default:
								sendError('Bad syntax/selection');
								return; 
						}
					}
				}); 
			});
			if (errMsg)
				{sendError(errMsg);}
			else
				{updateAllTokenMarkers();}
		}

		content += '<div style="background-color: '+design.statusbgcolor+'; border: 2px solid #000; box-shadow: rgba(0,0,0,0.4) 3px 3px; border-radius: 0.5em; text-align: center; font-weight: bold;">'
			+ '<div style="color: ' + design.statuscolor + '; font-weight: bold; border-bottom: 2px solid black;">'
				+ '<table width="100%"><tr><td width="100%"><span style="font-weight: bold; font-size: 125%">Edit Group Status "'+statusName+'"</span></td></tr></table>'
			+ '</div>';
		content += midcontent; 
		content += '</div>';
		
		if (midcontent)
			{sendFeedback(content);}
	}; 

	/**
	 * Add player statuses
	 */
	var doPlayerAddStatus = function(args, selection, senderId) {
		if (!args) 
			{return;}
		if (!selection) {
			sendResponseError('Invalid selection');
			return;
		}
		
		args = args.split(':');
		
		if (args.length <3 || args.length > 4) {
			sendResponseError('Invalid status item syntax');
			return;
		}
		var name = args[0],
			duration = parseInt(args[1]),
			direction = parseInt(args[2]),
			msg = args[3],
			statusArgs = {},
			statusArgsString = '',
			status,
			markerdef,
			hashes = [],
			curToken,
			pr_choosemarker,
			pr_nomarker,
			choosemarker_args = {},
			nomarker_args = {},
			content = '',
			midcontent = '',
			d = new Date();

		if (typeof(name) === 'string')
			{name = name.toLowerCase();}

		if (isNaN(duration) || isNaN(direction)) {
			sendResponseError('Invalid status item syntax');
			return;
		}

		if (!!(status=statusExists(name))) {
			markerdef = _.findWhere(statusMarkers,{name: status.marker});
		}

		statusArgs.name = name;
		statusArgs.duration = duration;
		statusArgs.direction = direction;
		statusArgs.msg = msg;
		statusArgs.marker = (markerdef ? markerdef.name:undefined); 
		statusArgsString = name + ' @ ' + duration + ' @ ' + direction + ' @ ' + msg; 

		hashes.push(genHash(d.getTime()*Math.random(),pending));
		hashes.push(genHash(d.getTime()*Math.random(),pending));
		choosemarker_args.hlist = hashes; 
		choosemarker_args.statusArgs = statusArgs;
		choosemarker_args.statusArgsString = statusArgsString; 
		choosemarker_args.senderId = senderId;
		choosemarker_args.selection = selection; 
		nomarker_args.hlist = hashes; 
		nomarker_args.statusArgs = statusArgs; 
		nomarker_args.senderId = senderId; 
		nomarker_args.selection = selection; 

		pr_choosemarker = new PendingResponse(PR_Enum.CUSTOM,function(args) {
			var hashes = [],
				pr_marker,
				content; 

			hashes.push(genHash(d.getTime()*Math.random(),pending));

			pr_marker = new PendingResponse(PR_Enum.CUSTOM,function(args, carry) {
				args.statusArgs.marker = carry;
				doDispPlayerStatusAllow(args.statusArgs,args.selection,args.senderId); 

			},args); 
			addPending(pr_marker,hashes[0]); 

			content = makeMarkerDisplay(undefined,false,'!tj -relay hc% ' 
				+ hashes[0] 
				+ ' %% ');

			sendResponse(args.senderId,content); 
			_.each(args.hlist,function(e) {
				clearPending(e) ;
			});
		},choosemarker_args);

		pr_nomarker = new PendingResponse(PR_Enum.CUSTOM,function(args) {
			sendResponse('<span style="color: orange; font-weight: bold;">Request sent for \''+statusArgs.name+'\'</span>'); 
			doDispPlayerStatusAllow(args.statusArgs,args.selection,args.senderId); 	
			_.each(args.hlist,function(e) {
				clearPending(e) ;
			});
		},nomarker_args); 

		addPending(pr_choosemarker,hashes[0]);
		addPending(pr_nomarker,hashes[1]); 


		_.each(selection,function(e) {
			curToken = getObj('graphic', e._id);
			if (!curToken || curToken.get('_subtype') !== 'token' || curToken.get('isdrawing'))
				{return;}
			midcontent += '<div style="width: 40px; height 40px; display: inline-block;"><img src="'+curToken.get('imgsrc')+'"></div>'; 
		});

		content += '<div style="font-weight: bold; background-color: '+design.statusbgcolor+'; border: 2px solid #000; box-shadow: rgba(0,0,0,0.4) 3px 3px; border-radius: 0.5em;">'
			+ '<div style="text-align: center; color: '+design.statuscolor+'; border-bottom: 2px solid black;">'
					+ '<span style="font-weight: bold; font-size: 120%">Request Add Status</span>'
				+ '</div>'
			+ 'Name: ' + '<span style="color:'+design.statuscolor+';">'+name+'</span>'
			+ '<br>Marker: ' + (markerdef ? ('<img src="'+markerdef.img+'"></img>'):'none')
			+ '<br>Duration: ' + duration
			+ '<br>Direction: ' + direction + (msg ? ('<br>Message: ' + msg):'')
			+ '<br><br><span style="font-style: normal;">Status requested to be placed on the following:</span><br>'; 
		content += midcontent; 
		content += (markerdef ? '': (
				'<div style="text-align: center;">'
				+ TrackerJacker_tmp.getTemplate({command: '!tj -relay hc% ' + hashes[0], text: 'Choose Marker'},'button')
				+ TrackerJacker_tmp.getTemplate({command: '!tj -relay hc% ' + hashes[1], text: 'Request Without Marker'},'button')
				+ '</div>'
			));
		content += '</div>'; 
		sendResponse(senderId,content); 

		if (markerdef)
			{doDispPlayerStatusAllow(statusArgs,selection,senderId);}
	};

	/**
	 * make dialog to allow/disallow a player status add
	 */ 
	var doDispPlayerStatusAllow = function(statusArgs,selection,senderId) {
		var hashes = [],
			confirmArgs = {},
			rejectArgs = {},
			pr_confirm,
			pr_reject,
			content = '',
			midcontent = '',
			player,
			markerdef,
			curToken,
			d = new Date();

		player = getObj('player',senderId);
		if (!player) {
			sendError('Non-existant player requested to add a status?');
			return; 
		}

		_.each(selection,function(e) {
			curToken = getObj('graphic', e._id);
			if (!curToken || curToken.get('_subtype') !== 'token' || curToken.get('isdrawing'))
				{return;}
			midcontent += '<div style="width: 40px; height 40px; display: inline-block;"><img src="'+curToken.get('imgsrc')+'"></div>'; 
		});

		hashes.push(genHash(d.getTime()*Math.random(),pending));
		hashes.push(genHash(d.getTime()*Math.random(),pending));
		confirmArgs.hlist = hashes;
		confirmArgs.statusArgs = statusArgs; 
		confirmArgs.selection = selection; 
		confirmArgs.senderId = senderId; 
		rejectArgs.hlist = hashes;
		rejectArgs.statusArgs = statusArgs; 
		rejectArgs.selection = selection; 
		rejectArgs.senderId = senderId;

		pr_confirm = new PendingResponse(PR_Enum.YESNO,function(args) {
			var argStr = args.statusArgs.name
					+ ':' + args.statusArgs.duration
					+ ':' + args.statusArgs.direction
					+ ':' + args.statusArgs.msg
					+ ':' + args.statusArgs.marker,
				markerdef; 
			markerdef = _.findWhere(statusMarkers,{name: statusArgs.marker});

			if (statusExists(args.statusArgs.name)) {
				doAddStatus(argStr,selection); 
			} else if(!!!_.find(state.trackerjacker.statuses,function(e){if (e.marker === args.statusArgs.marker){return true;}})) {
				doAddStatus(argStr,selection); 
			} else {
				sendError('Marker <img src="'+markerdef.img+'"></img> is already in use, cannot use it for \'' + args.statusArgs.name + '\' '); 
				sendResponseError(args.senderId,'Status application \''+statusArgs.name+'\' rejected, marker <img src="'+markerdef.img+'"></img> already in use'); 
				return; 
			}
			sendResponse(args.senderId,'<span style="color: green; font-weight: bold;">Status application for \''+statusArgs.name+'\' accepted</span>'); 

			_.each(args.hlist,function(e) {
				clearPending(e) ;
			});
		},confirmArgs);

		pr_reject = new PendingResponse(PR_Enum.YESNO,function(args) {
			var player = getObj('player',args.senderId); 
			if (!player)
				{sendError('Non-existant player requested to add a status?');}
			sendResponseError(args.senderId,'Status application for \''+statusArgs.name+'\' rejected'); 
			sendError('Rejected status application for \''+statusArgs.name+'\' from ' + player.get('_displayname')); 

			_.each(args.hlist,function(e) {
				clearPending(e) ;
			});
		},rejectArgs);

		addPending(pr_confirm,hashes[0]);
		addPending(pr_reject,hashes[1]); 


		markerdef = _.findWhere(statusMarkers,{name: statusArgs.marker});

		content += '<div style="font-weight: bold; background-color: '+design.statusbgcolor+'; border: 2px solid #000; box-shadow: rgba(0,0,0,0.4) 3px 3px; border-radius: 0.5em;">'
			+ '<div style="text-align: center; color: '+design.statuscolor+'; border-bottom: 2px solid black;">'
					+ '<span style="font-weight: bold; font-size: 120%">Request Add Status</span>'
				+ '</div>'
			+ '<span style="color:'+design.statuscolor+';">'+ player.get('_displayname') + '</span> requested to add the following status...<br>'
			+ '<br>Name: ' + '<span style="color:'+design.statuscolor+';">'+statusArgs.name+'</span>'
			+ '<br>Marker: ' + (markerdef ? ('<img src="'+markerdef.img+'"></img>'):'none')
			+ '<br>Duration: ' + statusArgs.duration
			+ '<br>Direction: ' + statusArgs.direction + (statusArgs.msg ? ('<br>Message: ' + statusArgs.msg):'')
			+ '<br><br><span style="font-style: normal;">Status requested to be placed on the following:</span><br>'; 
		content += midcontent; 

		content += '<table style="text-align: center; width: 100%">'
			+ '<tr>'
				+ '<td>'
					+ TrackerJacker_tmp.getTemplate({command: '!tj -relay hc% ' + hashes[0], text: 'Confirm'},'button')
				+ '</td>'
				+ '<td>'
					+ TrackerJacker_tmp.getTemplate({command: '!tj -relay hc% ' + hashes[1], text: 'Reject'},'button')
				+ '</td>'
			+ '</tr>'
		+ '</table>'; 
		// GM feedback
		sendFeedback(content); 
		// Player feedback
		sendResponse(senderId,'<span style="color: orange; font-weight: bold;">Request sent for \''+statusArgs.name+'\'</span>'); 
	}; 

	/**
	 * Performs a direct marker application to a status name.
	 * An internal command that is still sanitized to prevent
	 * awful things.
	 */
	var doDirectMarkerApply = function(args) {
		// directly apply a marker to a token id
		if (!args) 
			{return;}
		args = args.split(' %% ');
		if (!args) 
			{return;}
		
		var markerName = args[0],
			statusName = args[1],
			isFav = args[2]; 

		isFav = isFav === 'fav'; 

		if (typeof(markerName) === 'string') 
			{markerName = markerName.toLowerCase();}
		if (typeof(statusName) === 'string') 
			{statusName = statusName.toLowerCase();}
		
		var status,
			found,
			markerdef,
			oldMarker;

		// if we're a favorite we don't bother with the status and active effects.
		if (isFav) {
			var fav = favoriteExists(statusName); 
			if (fav) {
				fav.marker = markerName; 
				markerdef = _.findWhere(statusMarkers,{name: markerName});
				sendFeedback('<div style="color: green; font-weight: bold;">Marker for <i><b>Favorite</i> "'+statusName+'"</b> set as <div style="width: 21px; height 21px; display: inline-block;"><img src="'+markerdef.img+'"></img></div></div>' );
			} else {
				sendError('Favorite <u>"'+statusName+'"</u> does not exist.');
			}
			return; 
		}

		_.each(state.trackerjacker.statuses, function(e) {
			if (e.marker === markerName)
				{found = e;}
			if (e.name === statusName)
				{status = e;}
		});
		if (status) {
			if (found) {
				markerdef = _.findWhere(statusMarkers,{name: markerName});
				if (!markerdef) 
					{return;}
				sendError('Marker <div style="width: 21px; height 21px; display: inline-block;"><img src="'+markerdef.img+'"></img></div> already taken by "' + found.name + '"');
				// marker taken
			} else {
				if (status.marker) {
					oldMarker = status.marker; 
				}
				markerdef = _.findWhere(statusMarkers,{name: markerName});
				status.marker = markerName;
				if (!markerdef) 
					{return;}
				sendFeedback('<div style="color: green; font-weight: bold;">Marker for <b>"'+statusName+'"</b> set as <div style="width: 21px; height 21px; display: inline-block;"><img src="'+markerdef.img+'"></img></div></div>' );
				updateAllTokenMarkers([{name: '', marker: oldMarker}]);
			}
		}
	}; 
	
	/**
	 * Perform a status edit on a single token, internal command, but
	 * still performs sanitation of input to prevent awful things.
	 */ 
	var doEditStatus = function(args) {
		if (!args) {
			sendError('Bad syntax/selection');
			return; 
		}

		args = args.split(' %% '); 
		var action = args[0],
			tokenId = args[1],
			statusName = args[2],
			attrName = args[3], 
			newValue = args[4],
			effects,
			effectList,
			curToken,
			localEffect,
			fav,
			content = '',
			midcontent = ''; 

		if (!newValue) {
			newValue = '';
			attrName = attrName.replace('%%','').trim(); 
		}
		if (!action
		|| !statusName
		|| !attrName) {
			sendError('Bad syntax/selection values');
			return; 
		}

		// if no token is available
		curToken = getObj('graphic',tokenId);
		if (tokenId 
			&& curToken 
			&& (curToken.get('_subtype') !== 'token' ||  curToken.get('isdrawing'))) {
			sendError('Bad syntax/selection');
			return; 
		}
		if (action === 'change') {
			switch(attrName) {
				case 'name':
					var gstatus = statusExists(statusName); 
					if (!gstatus) {
						sendError('Status "'+statusName+'" does not exist');
						return; 
					}
					if (statusExists(newValue)) {
						sendError('Status name already exists');
						return; 
					}
					gstatus = statusExists(statusName); 
					newValue = newValue.toLowerCase(); 
					effectList = state.trackerjacker.effects; 
					_.each(effectList,function(effects) {
						_.each(effects,function(e) {
							if (e.name === statusName) {
								e.name = newValue; 
							}
						}); 
					});

					gstatus.name = newValue; 
					midcontent += 'Status name now: ' + newValue; 
					break; 
				case 'marker': 
					content = makeMarkerDisplay(statusName); 
					sendFeedback(content);
					return; 
				case 'duration': 
					effects = getStatusEffects(curToken);
					localEffect = _.findWhere(effects,{name: statusName});
					if (!localEffect || isNaN(newValue)) {
						sendError('Bad syntax/selection');
						return; 
					}
					localEffect.duration = parseInt(newValue); 
					midcontent += 'New "'+statusName+'" duration ' + newValue; 
					updateAllTokenMarkers(); 
					break; 
				case 'direction': 
					effects = getStatusEffects(curToken);
					localEffect = _.findWhere(effects,{name: statusName});
					if (!localEffect || isNaN(newValue)) {
						sendError('Bad syntax/selection');
						return; 
					}
					localEffect.direction = parseInt(newValue); 
					midcontent += 'New "'+statusName+'" direction ' + newValue; 
					updateAllTokenMarkers(); 
					break; 
				case 'message': 
					effects = getStatusEffects(curToken);
					localEffect = _.findWhere(effects,{name: statusName});
					if (!localEffect) {
						sendError('Bad syntax/selection');
						return; 
					}
					localEffect.msg = newValue; 
					midcontent += 'New "'+statusName+'" message ' + newValue; 
					break; 
				default:
					sendError('Bad syntax/selection');
					return; 
			}
		} else if (action === 'changefav') {
			switch(attrName) {
				case 'name':
					fav = favoriteExists(statusName); 
					if (favoriteExists(newValue)) {
						sendError('Favorite name already exists');
						return; 
					}
					fav.name = newValue.toLowerCase();
					//manually remove from state
					delete state.trackerjacker.favs[statusName]; 
					state.trackerjacker.favs[newValue] = fav; 
					midcontent += 'Status name now: ' + newValue; 
					break; 
				case 'marker': 
					fav = favoriteExists(statusName); 
					content = makeMarkerDisplay(statusName,fav); 
					sendFeedback(content);
					return; 
				case 'duration': 
					fav = favoriteExists(statusName); 
					if (!fav || isNaN(newValue)) {
						sendError('Bad syntax/selection');
					}
					fav.duration = parseInt(newValue); 
					midcontent += 'New "'+statusName+'" duration ' + newValue; 
					break; 
				case 'direction': 
					fav = favoriteExists(statusName); 
					if (!fav || isNaN(newValue)) {
						sendError('Bad syntax/selection');
					}
					fav.direction = parseInt(newValue); 
					midcontent += 'New "'+statusName+'" direction ' + newValue; 
					break; 
				case 'message': 
					fav = favoriteExists(statusName); 
					if (!fav) {
						sendError('Bad syntax/selection');
					}
					fav.msg = newValue; 
					midcontent += 'New "'+statusName+'" message ' + newValue; 
					break; 
				default:
					sendError('Bad syntax/selection');
					return; 
			}
		}

		content += '<div style="font-weight: bold; background-color: '+design.statusbgcolor+'; border: 2px solid #000; box-shadow: rgba(0,0,0,0.4) 3px 3px; border-radius: 0.5em; text-align: center;">'
			+ '<div style="color: '+design.statuscolor+'; border-bottom: 2px solid black;">'
				+ '<table width="100%"><tr><td width="100%"><span style="font-weight: bold; font-size: 125%">'+(curToken ? ('Editing "'+statusName+'" for'):('Editing Favorite ' + statusName))+'</span></td>'+ (tokenId ? ('<td width="32px" height="32px"><div style="width: 32px; height: 32px"><img src="'+curToken.get('imgsrc')+'"></img></div></td>'):'') +'</tr></table>'
			+ '</div>'; 
		content += midcontent; 
		content += '</div>'; 
		sendFeedback(content); 
		return;
	}; 
	
	/**
	 * Resets the turn order the the provided round number
	 * or in its absense, configures it to 1. Does no other
	 * operation other than change the round counter.
	 */ 
	var doResetTurnorder = function(args) {
		var initial = (typeof(args) === 'string' ? args.match(/\d+/) : 1);
		if (!initial) 
				{initial = 1;}
		var turnorder = Campaign().get('turnorder');
		if (turnorder && typeof(turnorder) === 'string') 
			{turnorder = JSON.parse(turnorder);}
		
		if (!turnorder) {
			prepareTurnorder();
		} else {
			if(!_.find(turnorder, function(e) {
				if (parseInt(e.id) === -1 && parseInt(e.pr) === -100 && e.custom.match(/Round\s*\d+/)) {
					e.custom = 'Round ' + initial;
					return true;
				}
			})) {
				prepareTurnorder();
			} else {
				updateTurnorderMarker(turnorder);
			}
		}
		
	};
	
	/**
	 * Get an array of controllers for the current token either
	 * from the direct token control, or linked journal control
	 */ 
	var getTokenControllers = function(token) {
		if (!token) 
			{return;}
		var controllers;
		if (token.get('represents')) {
			var journal = getObj('character',token.get('represents'));
			if (journal)
				{controllers = journal.get('controlledby').split(',');}
		} else {
			controllers = token.get('controlledby').split(',');
		}
		return controllers;
	}; 
	
	/**
	 * determine if the sender controls the token either by
	 * linked journal, or by direct token control.
	 */ 
	var isTokenController = function(token,senderId) {
		if (!token) {
			return false; 
		} else if (playerIsGM(senderId)) {
			return true; 	
		} else if (_.find(token.get('controlledby').split(','),function(e){return e===senderId;})) {
			return true;
		} else if (token.get('represents')) {
			var journal = getObj('character',token.get('represents'));
			if (journal && _.find(journal.get('controlledby').split(','),function(e){return e===senderId;})) {
				return true;
			}
		}
		return false;
	}; 
	
	/**
	 * Animate the tracker
	 *
	 * TODO make the rotation rate a field variable
	 */
	var animateTracker = function() {
		if (!flags.animating) 
			{return;}
		
		if (flags.tj_state === TJ_StateEnum.ACTIVE) {
			if (flags.rotation) {
				var graphic = findTrackerGraphic();
				graphic.set('rotation',parseInt(graphic.get('rotation'))+fields.rotation_degree);
			}
			setTimeout(function() {animateTracker();},500);
		} else if (flags.tj_state === TJ_StateEnum.PAUSED 
		|| flags.tj_state === TJ_StateEnum.FROZEN) {
			setTimeout(function() {animateTracker();},500);
		} else {
			flags.animating = false;
		}
	}; 
	
	/**
	 * Start/Pause the tracker, does not annouce the starting turn
	 * as if you're moving around while paused, to reposition, you
	 * don't want it to tick down on status effects.
	 */ 
	var doStartTracker = function() {
		if (flags.tj_state === TJ_StateEnum.ACTIVE) {
			doPauseTracker();
			return;
		}
		flags.tj_state = TJ_StateEnum.ACTIVE;
		prepareTurnorder();
		var curToken = findCurrentTurnToken();
		if (curToken) {
			var graphic = findTrackerGraphic();
			var maxsize = Math.max(parseInt(curToken.get('width')),parseInt(curToken.get('height')));
			graphic.set('layer','gmlayer');
			graphic.set('left',curToken.get('left'));
			graphic.set('top',curToken.get('top'));
			graphic.set('width',maxsize*fields.trackerImgRatio);
			graphic.set('height',maxsize*fields.trackerImgRatio);
			setTimeout(function() {
				if (!!(curToken = getObj('graphic',curToken.get('_id')))) {
					if (curToken.get('layer') === 'gmlayer') {
						graphic.set('layer','gmlayer');
						toBack(graphic);
					} else {
						graphic.set('layer','map');
						toFront(graphic);
					}
				}
			},500);
		}
		
		updateTurnorderMarker();
		if (!flags.animating) {
			flags.animating = true;
			animateTracker();
		}
	}; 
	
	/**
	 * Stops the tracker, removing all trackerjacker controlled
	 * statuses. 
	 */ 
	var doStopTracker = function() {
		flags.tj_state = TJ_StateEnum.STOPPED;
		// Remove Graphic
		var trackergraphics = findObjs({
				_type: 'graphic',
				name: fields.trackerName,
			});
		_.each(trackergraphics, function(elem) {
			if (elem)
				{elem.remove();} 
		}); 
		// Update turnorder
		updateTurnorderMarker();
		// Clean markers
		var toRemove = [];
		_.each(state.trackerjacker.statuses,function(e) {
			toRemove.push({name: '', marker: e.marker}); 
		});
		updateAllTokenMarkers(toRemove); 
		// Clean state
		state.trackerjacker.effects = {};
		state.trackerjacker.statuses = []; 
	}; 
	
	/**
	 * Pause the tracker 
	 *
	 * DEPRECATED due to toggle of !tj -start
	 */ 
	var doPauseTracker = function() {
		if(flags.tj_state === TJ_StateEnum.PAUSED) {
			doStartTracker();
		} else {
			flags.tj_state = TJ_StateEnum.PAUSED;	
			updateTurnorderMarker();
		}
	}; 
	
	/**
	 * Perform player controled turn advancement (!eot)
	 */ 
	var doPlayerAdvanceTurn = function(senderId) {
		if (!senderId || flags.tj_state !== TJ_StateEnum.ACTIVE) 
			{return;}
		var turnorder = Campaign().get('turnorder');
		if (!turnorder) 
			{return;} 
		if (typeof(turnorder) === 'string') 
			{turnorder = JSON.parse(turnorder);} 
		
		var token = getObj('graphic',turnorder[0].id);
		if (token && isTokenController(token,senderId)) {
			var priorOrder = JSON.stringify(turnorder);
			turnorder.push(turnorder.shift());
			turnorder = JSON.stringify(turnorder);
			handleAdvanceTurn(turnorder,priorOrder);
		}
	};
	
	/**
	 * Clear the turn order
	 */ 
	var doClearTurnorder = function() {
		Campaign().set('turnorder','');
		doStopTracker();
	}; 

	/**
	 * Handle Pending Requests
	 */
	var doRelay = function(args,senderId) {
		if (!args) 
			{return;}
		var carry,
			hash; 
		args = args.split(' %% '); 
		if (!args) { log(args); return; }
		hash = args[0];
		if (hash) {
			hash = hash.match(/hc% .+/);
			if (!hash) { log(hash); return; }
			hash = hash[0].replace('hc% ','');
			carry = args[1];
			if (carry)
				{carry = carry.trim();}
			var pr = findPending(hash);
			if (pr) {
				pr.doOps(carry);
				clearPending(hash);    
			} else {
				sendResponseError(senderId,'Selection Invalidated');
			}
		}
	}; 

	/**
	 * Show help message
	 */ 
	var showHelp = function() {
		var content = 
			'<div style="background-color: #FFF; border: 2px solid #000; box-shadow: rgba(0,0,0,0.4) 3px 3px; border-radius: 0.5em; margin-left: 2px; margin-right: 2px; padding-top: 5px; padding-bottom: 5px;">'
				+ '<div style="font-weight: bold; text-align: center; border-bottom: 2px solid black;">'
					+ '<span style="font-weight: bold; font-size: 125%">TrackerJacker v'+version+'</span>'
				+ '</div>'
				+ '<div style="padding-left: 5px; padding-right: 5px; overflow: hidden;">'
					+ '<div style="font-weight: bold;">'
						+ '!tj -help'
					+ '</div>'
					+ '<li style="padding-left: 10px;">'
						+ 'Display this message'
					+ '</li>'
					+ '<br>'
					+ '<div style="font-weight: bold;">'
						+ '!tj -start'
					+ '</div>'
					+ '<li style="padding-left: 10px;">'
						+ 'Start/Pause the tracker. If not started starts; if active pauses; if paused, resumes. Behaves as a toggle.'
					+ '</li>'
					+ '<br>'
					+ '<div style="font-weight: bold;">'
						+ '!tj -stop'
					+ '</div>'
					+ '<li style="padding-left: 10px;">'
						+ 'Stops the tracker and clears all status effects.'
					+ '</li>'
					+ '<br>'
					+ '<div style="font-weight: bold;">'
						+ '!tj -clear'
					+ '</div>'
					+ '<li style="padding-left: 10px;">'
						+ 'Stops the tracker as the -stop command, but in addition clears the turnorder'
					+ '</li>'
					+ '<br>'
					+ '<div style="font-weight: bold;">'
						+ '!tj -pause'
					+ '</div>'
					+ '<li style="padding-left: 10px;">'
						+ 'Pauses the tracker.'
					+ '</li>'
					+ '<br>'
					+ '<div style="font-weight: bold;">'
						+ '!tj -reset [round#]'
					+ '</div>'
					+ '<li style="padding-left: 10px;">'
						+ 'Reset the tracker\'s round counter to the given round, if none is supplied, it is set to round 1.'
					+ '</li>'
					+ '<br>'
					+ '<div style="font-weight: bold;">'
						+ '!tj -addstatus [name]:[duration]:[direction]:[message]'
					+ '</div>'
					+ '<li style="padding-left: 10px;">'
						+ 'Add a status to the group of selected tokens, if it does not have the named status.'
					+ '</li>'
					+ '<li style="padding-left: 20px;">'
						+ '<b>name</b> name of the status.'
					+ '</li>'
					+ '<li style="padding-left: 20px;">'
						+ '<b>duration</b> duration of the status (numeric).'
					+ '</li>'
					+ '<li style="padding-left: 20px;">'
						+ '<b>direction</b> + or - direction (+# or -#) indicating the increase or decrease of the the status\' duration when the token\'s turn comes up.'
					+ '</li>'
					+ '<li style="padding-left: 20px;">'
						+ '<b>message</b> optional description of the status. If dice text, ie: 1d4 exist, it\'ll roll this result when the token\'s turn comes up.'
					+ '</li>'
					+ '<br>'
					+ '<div style="font-weight: bold;">'
						+ '!tj -removestatus [name]'
					+ '</div>'
					+ '<li style="padding-left: 10px;">'
						+ 'Remove a status from a group of selected tokens given the name.'
					+ '</li>'
					+ '<br>'
					+ '<div style="font-weight: bold;">'
						+ '!tj -edit'
					+ '</div>'
					+ '<li style="padding-left: 10px;">'
						+ 'Edit statuses on the selected tokens'
					+ '</li>'
					+ '<br>' 
					+ '<div style="font-weight: bold;">'
						+ '!tj -addfav [name]:[duration]:[direction]:[message]'
					+ '</div>'
					+ '<li style="padding-left: 10px;">'
						+ 'Add a favorite status for quick application to selected tokens later.'
					+ '</li>'
					+ '<br>' 
					+ '<div style="font-weight: bold;">'
						+ '!tj -listfavs'
					+ '</div>'
					+ '<li style="padding-left: 10px;">'
						+ 'Displays favorite statuses with options to apply or edit.'
					+ '</li>'
					+ '<br>'
					+ '<div style="font-weight: bold;">'
						+ '!eot'
					+ '</div>'
					+ '<li style="padding-left: 10px;">'
						+ 'Ends a player\'s turn and advances the tracker if the player has control of the current turn\'s token. Player usable command.'
					+ '</li>'
				+ '</div>'
   			+ '</div>'; 

		sendFeedback(content); 
	}; 
	
	/**
	 * Send public message
	 */
	var sendPublic = function(msg) {
		if (!msg) 
			{return undefined;}
		var content = '/desc ' + msg;
		sendChat('',content,null,(flags.archive ? {noarchive:true}:null));
	};
	
	/**
	* Fake message is fake!
	*/
	var sendFeedback = function(msg) {
		var content = '/w GM '
				+ '<div style="position: absolute; top: 4px; left: 5px; width: 26px;">'
					+ '<img src="' + fields.feedbackImg + '">' 
				+ '</div>'
				+ msg;
			
		sendChat(fields.feedbackName,content,null,(flags.archive ? {noarchive:true}:null));
	};

	/**
	 * Sends a response
	 */
	var sendResponse = function(pid,msg,as,img) {
		if (!pid || !msg) 
			{return null;}
		var player = getObj('player',pid),
			to; 
		if (player) {
			to = '/w "' + player.get('_displayname') + '" ';
		}
		else 
			{throw ('could not find player: ' + to);}
		var content = to
				+ '<div style="position: absolute; top: 4px; left: 5px; width: 26px;">'
					+ '<img src="' + (img ? img:fields.feedbackImg) + '">' 
				+ '</div>'
				+ msg;
		sendChat((as ? as:fields.feedbackName),content);
	}; 

	var sendResponseError = function(pid,msg,as,img) {
		sendResponse(pid,'<span style="color: red; font-weight: bold;">'+msg+'</span>',as,img); 
	}; 

	/**
	 * Send an error
	 */ 
	var sendError = function(msg) {
		sendFeedback('<span style="color: red; font-weight: bold;">'+msg+'</span>'); 
	}; 
 
	/**
	 * Handle chat message event
	 */ 
	var handleChatMessage = function(msg) { 
		var args = msg.content,
			senderId = msg.playerid,
			selected = msg.selected; 
			
		if (msg.type === 'api'
		&& playerIsGM(senderId)
		&& args.indexOf('!tj') === 0) {
			args = args.replace('!tj','').trim();
			if (args.indexOf('-start') === 0) {
				doStartTracker();
			} else if (args.indexOf('-stop') === 0) {
				doStopTracker();
			} else if (args.indexOf('-pause') === 0) {
				doPauseTracker();
			} else if (args.indexOf('-reset') === 0) {
				args = args.replace('-reset','').trim();
				doResetTurnorder(args);
			} else if (args.indexOf('-addstatus') === 0) {
				args = args.replace('-addstatus','').trim();
				doAddStatus(args,selected);
			} else if (args.indexOf('-removestatus') === 0) {
				args = args.replace('-removestatus','').trim();
				doRemoveStatus(args,selected);
			} else if (args.indexOf('-clear') === 0) {
				doClearTurnorder();
			} else if (args.indexOf('-s_marker') === 0) {
				doShowMarkers();   
			} else if (args.indexOf('-dispmarker') === 0) {
				args = args.replace('-dispmarker','').trim();
				doDisplayMarkers(args);	 
			} else if (args.indexOf('-marker') === 0) {
				args = args.replace('-marker','').trim();
				doDirectMarkerApply(args);	 
			} else if (args.indexOf('-disptokenconfig') === 0) {
				args = args.replace('-disptokenconfig','').trim();
				doDisplayTokenConfig(args); 	
			} else if (args.indexOf('-dispstatusconfig') === 0) {
				// dirty fix
				args = args.replace('-dispstatusconfig','');
				doDisplayStatusConfig(args); 	
			} else if (args.indexOf('-listfav') === 0) {
				doDisplayFavConfig(); 	
			} else if (args.indexOf('-dispmultistatusconfig') === 0) {
				args = args.replace('-dispmultistatusconfig','').trim();
				doDisplayMultiStatusConfig(args); 	
			} else if (args.indexOf('-edit_status') === 0) {
				args = args.replace('-edit_status','').trim();
				doEditStatus(args); 	
			} else if (args.indexOf('-edit_multi_status') === 0) {
				args = args.replace('-edit_multi_status','').trim();
				doEditMultiStatus(args); 	
			} else if (args.indexOf('-edit') === 0) {
				args = args.replace('-edit','').trim();
				doMultiEditTokenStatus(selected); 	
			} else if (args.indexOf('-addfav') === 0) {
				args = args.replace('-addfav','').trim();
				doAddFavorite(args); 
			} else if (args.indexOf('-applyfav') === 0) {
				args = args.replace('-applyfav','').trim();
				doApplyFavorite(args,selected); 
			}  else if (args.indexOf('-relay') === 0) {
				args = args.replace('-relay','').trim(); 
				doRelay(args,senderId); 
			} else if (args.indexOf('-help') === 0) {
				showHelp(); 
			} else {
				sendFeedback('<span style="color: red;">Invalid command " <b>'+msg.content+'</b> "</span>');
				showHelp(); 
			}
		} else if (msg.type === 'api') {
			if (args.indexOf('!eot') === 0) {
				doPlayerAdvanceTurn(senderId);
			} else if (args.indexOf('!tj -addstatus') === 0) {
				args = args.replace('!tj -addstatus','').trim();
				doPlayerAddStatus(args,selected,senderId); 	
			}  else if (args.indexOf('!tj -relay') === 0) {
				args = args.replace('!tj -relay','').trim(); 
				doRelay(args,senderId); 
			}
		}
	};

	/**
	 * Handle turn order change event
	 */ 	
	var handleChangeCampaignTurnorder = function(obj,prev) {
		handleAdvanceTurn(obj.get('turnorder'),prev.turnorder);
	};
	
	var handleChangeCampaignInitativepage = function(obj,prev) {
		if (obj.get('initiativepage')) {
			prepareTurnorder(obj.get('turnorder'));
		} else {
			if (flags.clearonclose)
				{doClearTurnorder();}
		}
	};
	
	/**
	 * Handle Graphic movement events
	 */ 
	var handleChangeGraphicMovement = function(obj,prev) {
		if (!flags.image || flags.tj_state === TJ_StateEnum.STOPPED) 
			{return;}
		var graphic = findTrackerGraphic(),
			curToken = findCurrentTurnToken(),
			maxsize = 0; 

		if (!curToken || curToken.get('_id') !== obj.get('_id'))
			{return;}
		
		maxsize = Math.max(parseInt(curToken.get('width')),parseInt(curToken.get('height')));
		graphic.set('layer','gmlayer');
		graphic.set('left',curToken.get('left'));
		graphic.set('top',curToken.get('top'));
		graphic.set('width',maxsize*fields.trackerImgRatio);
		graphic.set('height',maxsize*fields.trackerImgRatio);
		if (flags.tj_state === TJ_StateEnum.ACTIVE)
			{flags.tj_state = TJ_StateEnum.FROZEN;}
		setTimeout(function() {
			if (graphic) {
				if (curToken.get('layer') === 'gmlayer') {
					graphic.set('layer','gmlayer');
					toBack(graphic);
				} else {
					graphic.set('layer','map');
					toFront(graphic);
				}
				if (flags.tj_state === TJ_StateEnum.FROZEN)
					{flags.tj_state = TJ_StateEnum.ACTIVE;}
			}
		},500);
	};
	
	/**
	 * Register and bind event handlers
	 */ 
	var registerAPI = function() {
		on('chat:message',handleChatMessage);
		on('change:campaign:turnorder',handleChangeCampaignTurnorder);
		on('change:campaign:initiativepage',handleChangeCampaignInitativepage);
		on('change:graphic:top',handleChangeGraphicMovement);
		on('change:graphic:left',handleChangeGraphicMovement);
		on('change:graphic:layer',handleChangeGraphicMovement);
	};
 
	return {
		init: init,
		registerAPI: registerAPI
	};
 
}());

on("ready", function() {
	'use strict'; 
	TrackerJacker.init(); 
	TrackerJacker.registerAPI();
});
