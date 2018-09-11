= function() {

   var o = id(sm2.debugID),
   oT = id(sm2.debugID + '-toggle');

   if (!o) {
     return;
   }

   if (debugOpen) {
     // minimize
     oT.innerHTML = '+';
     o.style.display = 'none';
   } else {
     oT.innerHTML = '-';
     o.style.display = 'block';
   }

   debugOpen = !debugOpen;

 };

 debugTS = function(sEventType, bSuccess, sMessage) {

   // troubleshooter debug hooks

   if (window.sm2Debugger !== _undefined) {
     try {
       sm2Debugger.handleEvent(sEventType, bSuccess, sMessage);
     } catch(e) {
       // oh well
       return false;
     }
   }

   return true;

 };
 // </d>

 getSWFCSS = function() {

   var css = [];

   if (sm2.debugMode) {
     css.push(swfCSS.sm2Debug);
   }

   if (sm2.debugFlash) {
     css.push(swfCSS.flashDebug);
   }

   if (sm2.useHighPerformance) {
     css.push(swfCSS.highPerf);
   }

   return css.join(' ');

 };

 flashBlockHandler = function() {

   // *possible* flash block situation.

   var name = str('fbHandler'),
       p = sm2.getMoviePercent(),
       css = swfCSS,
       error = {
         type: 'FLASHBLOCK'
       };

   if (sm2.html5Only) {
     // no flash, or unused
     return;
   }

   if (!sm2.ok()) {

     if (needsFlash) {
       // make the movie more visible, so user can fix
       sm2.oMC.className = getSWFCSS() + ' ' + css.swfDefault + ' ' + (p === null ? css.swfTimedout : css.swfError);
       sm2._wD(name + ': ' + str('fbTimeout') + (p ? ' (' + str('fbLoaded') + ')' : ''));
     }

     sm2.didFlashBlock = true;

     // fire onready(), complain lightly
     processOnEvents({
       type: 'ontimeout',
       ignoreInit: true,
       error: error
     });

     catchError(error);

   } else {

     // SM2 loaded OK (or recovered)

     // <d>
     if (sm2.didFlashBlock) {
       sm2._wD(name + ': Unblocked');
     }
     // </d>

     if (sm2.oMC) {
       sm2.oMC.className = [getSWFCSS(), css.swfDefault, css.swfLoaded + (sm2.didFlashBlock ? ' ' + css.swfUnblocked : '')].join(' ');
     }

   }

 };

 addOnEvent = function(sType, oMethod, oScope) {

   if (on_queue[sType] === _undefined) {
     on_queue[sType] = [];
   }

   on_queue[sType].push({
     method: oMethod,
     scope: (oScope || null),
     fired: false
   });

 };

 processOnEvents = function(oOptions) {

   // if unspecified, assume OK/error

   if (!oOptions) {
     oOptions = {
       type: (sm2.ok() ? 'onready' : 'ontimeout')
     };
   }

   // not ready yet.
   if (!didInit && oOptions && !oOptions.ignoreInit) return false;

   // invalid case
   if (oOptions.type === 'ontimeout' && (sm2.ok() || (disabled && !oOptions.ignoreInit))) return false;

   var status = {
         success: (oOptions && oOptions.ignoreInit ? sm2.ok() : !disabled)
       },

       // queue specified by type, or none
       srcQueue = (oOptions && oOptions.type ? on_queue[oOptions.type] || [] : []),

       queue = [], i, j,
       args = [status],
       canRetry = (needsFlash && !sm2.ok());

   if (oOptions.error) {
     args[0].error = oOptions.error;
   }

   for (i = 0, j = srcQueue.length; i < j; i++) {
     if (srcQueue[i].fired !== true) {
       queue.push(srcQueue[i]);
     }
   }

   if (queue.length) {

     // sm2._wD(sm + ': Firing ' + queue.length + ' ' + oOptions.type + '() item' + (queue.length === 1 ? '' : 's'));
     for (i = 0, j = queue.length; i < j; i++) {

       if (queue[i].scope) {
         queue[i].method.apply(queue[i].scope, args);
       } else {
         queue[i].method.apply(this, args);
       }

       if (!canRetry) {
         // useFlashBlock and SWF timeout case doesn't count here.
         queue[i].fired = true;

       }

     }

   }

   return true;

 };

 initUserOnload = function() {

   window.setTimeout(function() {

     if (sm2.useFlashBlock) {
       flashBlockHandler();
     }

     processOnEvents();

     // call user-defined "onload", scoped to window

     if (typeof sm2.onload === 'function') {
       _wDS('onload', 1);
       sm2.onload.apply(window);
       _wDS('onloadOK', 1);
     }

     if (sm2.waitForWindowLoad) {
       event.add(window, 'load', initUserOnload);
     }

   }, 1);

 };

 detectFlash = function() {

   /**
    * Hat tip: Flash Detect library (BSD, (C) 2007) by Carl "DocYes" S. Yestrau
    * http://featureblend.com/javascript-flash-detection-library.html / http://featureblend.com/license.txt
    */

   // this work has already been done.
   if (hasFlash !== _undefined) return hasFlash;

   var hasPlugin = false, n = navigator, obj, type, types, AX = window.ActiveXObject;

   // MS Edge 14 throws an "Unspecified Error" because n.plugins is inaccessible due to permissions
   var nP;

   try {
     nP = n.plugins;
   } catch(e) {
     nP = undefined;
   }

   if (nP && nP.length) {

     type = 'application/x-shockwave-flash';
     types = n.mimeTypes;

     if (types && types[type] && types[type].enabledPlugin && types[type].enabledPlugin.description) {
       hasPlugin = true;
     }

   } else if (AX !== _undefined && !ua.match(/MSAppHost/i)) {

     // Windows 8 Store Apps (MSAppHost) are weird (compatibility?) and won't complain here, but will barf if Flash/ActiveX object is appended to the DOM.
     try {
       obj = new AX('ShockwaveFlash.ShockwaveFlash');
     } catch(e) {
       // oh well
       obj = null;
     }

     hasPlugin = (!!obj);

     // cleanup, because it is ActiveX after all
     obj = null;

   }

   hasFlash = hasPlugin;

   return hasPlugin;

 };

 featureCheck = function() {

   var flashNeeded,
       item,
       formats = sm2.audioFormats,
       // iPhone <= 3.1 has broken HTML5 audio(), but firmware 3.2 (original iPad) + iOS4 works.
       isSpecial = (is_iDevice && !!(ua.match(/os (1|2|3_0|3_1)\s/i)));

   if (isSpecial) {

     // has Audio(), but is broken; let it load links directly.
     sm2.hasHTML5 = false;

     // ignore flash case, however
     sm2.html5Only = true;

     // hide the SWF, if present
     if (sm2.oMC) {
       sm2.oMC.style.display = 'none';
     }

   } else if (sm2.useHTML5Audio) {

       if (!sm2.html5 || !sm2.html5.canPlayType) {
         sm2._wD('SoundManager: No HTML5 Audio() support detected.');
         sm2.hasHTML5 = false;
       }

       // <d>
       if (isBadSafari) {
         sm2._wD(smc + 'Note: Buggy HTML5 Audio in Safari on this OS X release, see https://bugs.webkit.org/show_bug.cgi?id=32159 - ' + (!hasFlash ? ' would use flash fallback for MP3/MP4, but none detected.' : 'will use flash fallback for MP3/MP4, if available'), 1);
       }
       // </d>

     }

   if (sm2.useHTML5Audio && sm2.hasHTML5) {

     // sort out whether flash is optional, required or can be ignored.

     // innocent until proven guilty.
     canIgnoreFlash = true;

     for (item in formats) {

       if (formats.hasOwnProperty(item)) {

         if (formats[item].required) {

           if (!sm2.html5.canPlayType(formats[item].type)) {

             // 100% HTML5 mode is not possible.
             canIgnoreFlash = false;
             flashNeeded = true;

           } else if (sm2.preferFlash && (sm2.flash[item] || sm2.flash[formats[item].type])) {

             // flash may be required, or preferred for this format.
             flashNeeded = true;

           }

         }

       }

     }

   }

   // sanity check...
   if (sm2.ignoreFlash) {
     flashNeeded = false;
     canIgnoreFlash = true;
   }

   sm2.html5Only = (sm2.hasHTML5 && sm2.useHTML5Audio && !flashNeeded);

   return (!sm2.html5Only);

 };

 parseURL = function(url) {

   /**
    * Internal: Finds and returns the first playable URL (or failing that, the first URL.)
    * @param {string or array} url A single URL string, OR, an array of URL strings or {url:'/path/to/resource', type:'audio/mp3'} objects.
    */

   var i, j, urlResult = 0, result;

   if (url instanceof Array) {

     // find the first good one
     for (i = 0, j = url.length; i < j; i++) {

       if (url[i] instanceof Object) {

         // MIME check
         if (sm2.canPlayMIME(url[i].type)) {
           urlResult = i;
           break;
         }

       } else if (sm2.canPlayURL(url[i])) {

         // URL string check
         urlResult = i;
         break;

       }

     }

     // normalize to string
     if (url[urlResult].url) {
       url[urlResult] = url[urlResult].url;
     }

     result = url[urlResult];

   } else {

     // single URL case
     result = url;

   }

   return result;

 };


 startTimer = function(oSound) {

   /**
    * attach a timer to this sound, and start an interval if needed
    */

   if (!oSound._hasTimer) {

     oSound._hasTimer = true;

     if (!mobileHTML5 && sm2.html5PollingInterval) {

       if (h5IntervalTimer === null && h5TimerCount === 0) {

         h5IntervalTimer = setInterval(timerExecute, sm2.html5PollingInterval);

       }

       h5TimerCount++;

     }

   }

 };

 stopTimer = function(oSound) {

   /**
    * detach a timer
    */

   if (oSound._hasTimer) {

     oSound._hasTimer = false;

     if (!mobileHTML5 && sm2.html5PollingInterval) {

       // interval will stop itself at next execution.

       h5TimerCount--;

     }

   }

 };

 timerExecute = function() {

   /**
    * manual polling for HTML5 progress events, ie., whileplaying()
    * (can achieve greater precision than conservative default HTML5 interval)
    */

   var i;

   if (h5IntervalTimer !== null && !h5TimerCount) {

     // no active timers, stop polling interval.

     clearInterval(h5IntervalTimer);

     h5IntervalTimer = null;

     return;

   }

   // check all HTML5 sounds with timers

   for (i = sm2.soundIDs.length - 1; i >= 0; i--) {

     if (sm2.sounds[sm2.soundIDs[i]].isHTML5 && sm2.sounds[sm2.soundIDs[i]]._hasTimer) {
       sm2.sounds[sm2.soundIDs[i]]._onTimer();
     }

   }

 };

 catchError = function(options) {

   options = (options !== _undefined ? options : {});

   if (typeof sm2.onerror === 'function') {
     sm2.onerror.apply(window, [{
       type: (options.type !== _undefined ? options.type : null)
     }]);
   }

   if (options.fatal !== _undefined && options.fatal) {
     sm2.disable();
   }

 };

 badSafariFix = function() {

   // special case: "bad" Safari (OS X 10.3 - 10.7) must fall back to flash for MP3/MP4
   if (!isBadSafari || !detectFlash()) {
     // doesn't apply
     return;
   }

   var aF = sm2.audioFormats, i, item;

   for (item in aF) {

     if (aF.hasOwnProperty(item)) {

       if (item === 'mp3' || item === 'mp4') {

         sm2._wD(sm + ': Using flash fallback for ' + item + ' format');
         sm2.html5[item] = false;

         // assign result to related formats, too
         if (aF[item] && aF[item].related) {
           for (i = aF[item].related.length - 1; i >= 0; i--) {
             sm2.html5[aF[item].related[i]] = false;
           }
         }

       }

     }

   }

 };

 /**
  * Pseudo-private flash/ExternalInterface methods
  * ----------------------------------------------
  */

 this._setSandboxType = function(sandboxType) {

   // <d>
   // Security sandbox according to Flash plugin
   var sb = sm2.sandbox;

   sb.type = sandboxType;
   sb.description = sb.types[(sb.types[sandboxType] !== _undefined ? sandboxType : 'unknown')];

   if (sb.type === 'localWithFile') {

     sb.noRemote = true;
     sb.noLocal = false;
     _wDS('secNote', 2);

   } else if (sb.type === 'localWithNetwork') {

     sb.noRemote = false;
     sb.noLocal = true;

   } else if (sb.type === 'localTrusted') {

     sb.noRemote = false;
     sb.noLocal = false;

   }
   // </d>

 };

 this._externalInterfaceOK = function(swfVersion) {

   // flash callback confirming flash loaded, EI working etc.
   // swfVersion: SWF build string

   if (sm2.swfLoaded) {
     return;
   }

   var e;

   debugTS('swf', true);
   debugTS('flashtojs', true);
   sm2.swfLoaded = true;
   tryInitOnFocus = false;

   if (isBadSafari) {
     badSafariFix();
   }

   // complain if JS + SWF build/version strings don't match, excluding +DEV builds
   // <d>
   if (!swfVersion || swfVersion.replace(/\+dev/i, '') !== sm2.versionNumber.replace(/\+dev/i, '')) {

     e = sm + ': Fatal: JavaScript file build "' + sm2.versionNumber + '" does not match Flash SWF build "' + swfVersion + '" at ' + sm2.url + '. Ensure both are up-to-date.';

     // escape flash -> JS stack so this error fires in window.
     setTimeout(function() {
       throw new Error(e);
     }, 0);

     // exit, init will fail with timeout
     return;

   }
   // </d>

   // IE needs a larger timeout
   setTimeout(init, isIE ? 100 : 1);

 };

 /**
  * Private initialization helpers
  * ------------------------------
  */

 createMovie = function(movieID, movieURL) {

   // ignore if already connected
   if (didAppend && appendSuccess) return false;

   function initMsg() {

     // <d>

     var options = [],
         title,
         msg = [],
         delimiter = ' + ';

     title = 'SoundManager ' + sm2.version + (!sm2.html5Only && sm2.useHTML5Audio ? (sm2.hasHTML5 ? ' + HTML5 audio' : ', no HTML5 audio support') : '');

     if (!sm2.html5Only) {

       if (sm2.preferFlash) {
         options.push('preferFlash');
       }

       if (sm2.useHighPerformance) {
         options.push('useHighPerformance');
       }

       if (sm2.flashPollingInterval) {
         options.push('flashPollingInterval (' + sm2.flashPollingInterval + 'ms)');
       }

       if (sm2.html5PollingInterval) {
         options.push('html5PollingInterval (' + sm2.html5PollingInterval + 'ms)');
       }

       if (sm2.wmode) {
         options.push('wmode (' + sm2.wmode + ')');
       }

       if (sm2.debugFlash) {
         options.push('debugFlash');
       }

       if (sm2.useFlashBlock) {
         options.push('flashBlock');
       }

     } else if (sm2.html5PollingInterval) {
         options.push('html5PollingInterval (' + sm2.html5PollingInterval + 'ms)');
       }

     if (options.length) {
       msg = msg.concat([options.join(delimiter)]);
     }

     sm2._wD(title + (msg.length ? delimiter + msg.join(', ') : ''), 1);

     showSupport();

     // </d>

   }

   if (sm2.html5Only) {

     // 100% HTML5 mode
     setVersionInfo();

     initMsg();
     sm2.oMC = id(sm2.movieID);
     init();

     // prevent multiple init attempts
     didAppend = true;

     appendSuccess = true;

     return false;

   }

   // flash path
   var remoteURL = (movieURL || sm2.url),
   localURL = (sm2.altURL || remoteURL),
   swfTitle = 'JS/Flash audio component (SoundManager 2)',
   oTarget = getDocument(),
   extraClass = getSWFCSS(),
   isRTL = null,
   html = doc.getElementsByTagName('html')[0],
   oEmbed, oMovie, tmp, movieHTML, oEl, s, x, sClass;

   isRTL = (html && html.dir && html.dir.match(/rtl/i));
   movieID = (movieID === _undefined ? sm2.id : movieID);

   function param(name, value) {
     return '<param name="' + name + '" value="' + value + '" />';
   }

   // safety check for legacy (change to Flash 9 URL)
   setVersionInfo();
   sm2.url = normalizeMovieURL(overHTTP ? remoteURL : localURL);
   movieURL = sm2.url;

   sm2.wmode = (!sm2.wmode && sm2.useHighPerformance ? 'transparent' : sm2.wmode);

   if (sm2.wmode !== null && (ua.match(/msie 8/i) || (!isIE && !sm2.useHighPerformance)) && navigator.platform.match(/win32|win64/i)) {
     /**
      * extra-special case: movie doesn't load until scrolled into view when using wmode = anything but 'window' here
      * does not apply when using high performance (position:fixed means on-screen), OR infinite flash load timeout
      * wmode breaks IE 8 on Vista + Win7 too in some cases, as of January 2011 (?)
      */
     messages.push(strings.spcWmode);
     sm2.wmode = null;
   }

   oEmbed = {
     name: movieID,
     id: movieID,
     src: movieURL,
     quality: 'high',
     allowScriptAccess: sm2.allowScriptAccess,
     bgcolor: sm2.bgColor,
     pluginspage: http + 'www.macromedia.com/go/getflashplayer',
     title: swfTitle,
     type: 'application/x-shockwave-flash',
     wmode: sm2.wmode,
     // http://help.adobe.com/en_US/as3/mobile/WS4bebcd66a74275c36cfb8137124318eebc6-7ffd.html
     hasPriority: 'true'
   };

   if (sm2.debugFlash) {
     oEmbed.FlashVars = 'debug=1';
   }

   if (!sm2.wmode) {
     // don't write empty attribute
     delete oEmbed.wmode;
   }

   if (isIE) {

     // IE is "special".
     oMovie = doc.createElement('div');
     movieHTML = [
       '<object id="' + movieID + '" data="' + movieURL + '" type="' + oEmbed.type + '" title="' + oEmbed.title + '" classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" codebase="http://download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab#version=6,0,40,0">',
       param('movie', movieURL),
       param('AllowScriptAccess', sm2.allowScriptAccess),
       param('quality', oEmbed.quality),
       (sm2.wmode ? param('wmode', sm2.wmode) : ''),
       param('bgcolor', sm2.bgColor),
       param('hasPriority', 'true'),
       (sm2.debugFlash ? param('FlashVars', oEmbed.FlashVars) : ''),
       '</object>'
     ].join('');

   } else {

     oMovie = doc.createElement('embed');
     for (tmp in oEmbed) {
       if (oEmbed.hasOwnProperty(tmp)) {
         oMovie.setAttribute(tmp, oEmbed[tmp]);
       }
     }

   }

   initDebug();
   extraClass = getSWFCSS();
   oTarget = getDocument();

   if (oTarget) {

     sm2.oMC = (id(sm2.movieID) || doc.createElement('div'));

     if (!sm2.oMC.id) {

       sm2.oMC.id = sm2.movieID;
       sm2.oMC.className = swfCSS.swfDefault + ' ' + extraClass;
       s = null;
       oEl = null;

       if (!sm2.useFlashBlock) {
         if (sm2.useHighPerformance) {
           // on-screen at all times
           s = {
             position: 'fixed',
             width: '8px',
             height: '8px',
             // >= 6px for flash to run fast, >= 8px to start up under Firefox/win32 in some cases. odd? yes.
             bottom: '0px',
             left: '0px',
             overflow: 'hidden'
           };
         } else {
           // hide off-screen, lower priority
           s = {
             position: 'absolute',
             width: '6px',
             height: '6px',
             top: '-9999px',
             left: '-9999px'
           };
           if (isRTL) {
             s.left = Math.abs(parseInt(s.left, 10)) + 'px';
           }
         }
       }

       if (isWebkit) {
         // soundcloud-reported render/crash fix, safari 5
         sm2.oMC.style.zIndex = 10000;
       }

       if (!sm2.debugFlash) {
         for (x in s) {
           if (s.hasOwnProperty(x)) {
             sm2.oMC.style[x] = s[x];
           }
         }
       }

       try {

         if (!isIE) {
           sm2.oMC.appendChild(oMovie);
         }

         oTarget.appendChild(sm2.oMC);

         if (isIE) {
           oEl = sm2.oMC.appendChild(doc.createElement('div'));
           oEl.className = swfCSS.swfBox;
           oEl.innerHTML = movieHTML;
         }

         appendSuccess = true;

       } catch(e) {

         throw new Error(str('domError') + ' \n' + e.toString());

       }

     } else {

       // SM2 container is already in the document (eg. flashblock use case)
       sClass = sm2.oMC.className;
       sm2.oMC.className = (sClass ? sClass + ' ' : swfCSS.swfDefault) + (extraClass ? ' ' + extraClass : '');
       sm2.oMC.appendChild(oMovie);

       if (isIE) {
         oEl = sm2.oMC.appendChild(doc.createElement('div'));
         oEl.className = swfCSS.swfBox;
         oEl.innerHTML = movieHTML;
       }

       appendSuccess = true;

     }

   }

   didAppend = true;

   initMsg();

   // sm2._wD(sm + ': Trying to load ' + movieURL + (!overHTTP && sm2.altURL ? ' (alternate URL)' : ''), 1);

   return true;

 };

 initMovie = function() {

   if (sm2.html5Only) {
     createMovie();
     return false;
   }

   // attempt to get, or create, movie (may already exist)
   if (flash) return false;

   if (!sm2.url) {

     /**
      * Something isn't right - we've reached init, but the soundManager url property has not been set.
      * User has not called setup({url: ...}), or has not set soundManager.url (legacy use case) directly before init time.
      * Notify and exit. If user calls setup() with a url: property, init will be restarted as in the deferred loading case.
      */

      _wDS('noURL');
      return false;

   }

   // inline markup case
   flash = sm2.getMovie(sm2.id);

   if (!flash) {

     if (!oRemoved) {

       // try to create
       createMovie(sm2.id, sm2.url);

     } else {

       // try to re-append removed movie after reboot()
       if (!isIE) {
         sm2.oMC.appendChild(oRemoved);
       } else {
         sm2.oMC.innerHTML = oRemovedHTML;
       }

       oRemoved = null;
       didAppend = true;

     }

     flash = sm2.getMovie(sm2.id);

   }

   if (typeof sm2.oninitmovie === 'function') {
     setTimeout(sm2.oninitmovie, 1);
   }

   // <d>
   flushMessages();
   // </d>

   return true;

 };

 delayWaitForEI = function() {

   setTimeout(waitForEI, 1000);

 };

 rebootIntoHTML5 = function() {

   // special case: try for a reboot with preferFlash: false, if 100% HTML5 mode is possible and useFlashBlock is not enabled.

   window.setTimeout(function() {

     complain(smc + 'useFlashBlock is false, 100% HTML5 mode is possible. Rebooting with preferFlash: false...');

     sm2.setup({
       preferFlash: false
     }).reboot();

     // if for some reason you want to detect this case, use an ontimeout() callback and look for html5Only and didFlashBlock == true.
     sm2.didFlashBlock = true;

     sm2.beginDelayedInit();

   }, 1);

 };

 waitForEI = function() {

   var p,
       loadIncomplete = false;

   if (!sm2.url) {
     // No SWF url to load (noURL case) - exit for now. Will be retried when url is set.
     return;
   }

   if (waitingForEI) {
     return;
   }

   waitingForEI = true;
   event.remove(window, 'load', delayWaitForEI);

   if (hasFlash && tryInitOnFocus && !isFocused) {
     // Safari won't load flash in background tabs, only when focused.
     _wDS('waitFocus');
     return;
   }

   if (!didInit) {
     p = sm2.getMoviePercent();
     if (p > 0 && p < 100) {
       loadIncomplete = true;
     }
   }

   setTimeout(function() {

     p = sm2.getMoviePercent();

     if (loadIncomplete) {
       // special case: if movie *partially* loaded, retry until it's 100% before assuming failure.
       waitingForEI = false;
       sm2._wD(str('waitSWF'));
       window.setTimeout(delayWaitForEI, 1);
       return;
     }

     // <d>
     if (!didInit) {

       sm2._wD(sm + ': No Flash response within expected time. Likely causes: ' + (p === 0 ? 'SWF load failed, ' : '') + 'Flash blocked or JS-Flash security error.' + (sm2.debugFlash ? ' ' + str('checkSWF') : ''), 2);

       if (!overHTTP && p) {

         _wDS('localFail', 2);

         if (!sm2.debugFlash) {
           _wDS('tryDebug', 2);
         }

       }

       if (p === 0) {

         // if 0 (not null), probably a 404.
         sm2._wD(str('swf404', sm2.url), 1);

       }

       debugTS('flashtojs', false, ': Timed out' + (overHTTP ? ' (Check flash security or flash blockers)' : ' (No plugin/missing SWF?)'));

     }
     // </d>

     // give up / time-out, depending

     if (!didInit && okToDisable) {

       if (p === null) {

         // SWF failed to report load progress. Possibly blocked.

         if (sm2.useFlashBlock || sm2.flashLoadTimeout === 0) {

           if (sm2.useFlashBlock) {

             flashBlockHandler();

           }

           _wDS('waitForever');

         } else if (!sm2.useFlashBlock && canIgnoreFlash) {

           // no custom flash block handling, but SWF has timed out. Will recover if user unblocks / allows SWF load.
           rebootIntoHTML5();

         } else {

           _wDS('waitForever');

           // fire any regular registered ontimeout() listeners.
           processOnEvents({
             type: 'ontimeout',
             ignoreInit: true,
             error: {
               type: 'INIT_FLASHBLOCK'
             }
           });

         }

       } else if (sm2.flashLoadTimeout === 0) {

         // SWF loaded? Shouldn't be a blocking issue, then.

         _wDS('waitForever');

       } else if (!sm2.useFlashBlock && canIgnoreFlash) {

         rebootIntoHTML5();

       } else {

         failSafely(true);

       }

     }

   }, sm2.flashLoadTimeout);

 };

 handleFocus = function() {

   function cleanup() {
     event.remove(window, 'focus', handleFocus);
   }

   if (isFocused || !tryInitOnFocus) {
     // already focused, or not special Safari background tab case
     cleanup();
     return true;
   }

   okToDisable = true;
   isFocused = true;
   _wDS('gotFocus');

   // allow init to restart
   waitingForEI = false;

   // kick off ExternalInterface timeout, now that the SWF has started
   delayWaitForEI();

   cleanup();
   return true;

 };

 flushMessages = function() {

   // <d>

   // SM2 pre-init debug messages
   if (messages.length) {
     sm2._wD('SoundManager 2: ' + messages.join(' '), 1);
     messages = [];
   }

   // </d>

 };

 showSupport = function() {

   // <d>

   flushMessages();

   var item, tests = [];

   if (sm2.useHTML5Audio && sm2.hasHTML5) {
     for (item in sm2.audioFormats) {
       if (sm2.audioFormats.hasOwnProperty(item)) {
         tests.push(item + ' = ' + sm2.html5[item] + (!sm2.html5[item] && needsFlash && sm2.flash[item] ? ' (using flash)' : (sm2.preferFlash && sm2.flash[item] && needsFlash ? ' (preferring flash)' : (!sm2.html5[item] ? ' (' + (sm2.audioFormats[item].required ? 'required, ' : '') + 'and no flash support)' : ''))));
       }
     }
     sm2._wD('SoundManager 2 HTML5 support: ' + tests.join(', '), 1);
   }

   // </d>

 };

 initComplete = function(bNoDisable) {

   if (didInit) return false;

   if (sm2.html5Only) {
     // all good.
     _wDS('sm2Loaded', 1);
     didInit = true;
     initUserOnload();
     debugTS('onload', true);
     return true;
   }

   var wasTimeout = (sm2.useFlashBlock && sm2.flashLoadTimeout && !sm2.getMoviePercent()),
       result = true,
       error;

   if (!wasTimeout) {
     didInit = true;
   }

   error = {
     type: (!hasFlash && needsFlash ? 'NO_FLASH' : 'INIT_TIMEOUT')
   };

   sm2._wD('SoundManager 2 ' + (disabled ? 'failed to load' : 'loaded') + ' (' + (disabled ? 'Flash security/load error' : 'OK') + ') ' + String.fromCharCode(disabled ? 10006 : 10003), disabled ? 2 : 1);

   if (disabled || bNoDisable) {

     if (sm2.useFlashBlock && sm2.oMC) {
       sm2.oMC.className = getSWFCSS() + ' ' + (sm2.getMoviePercent() === null ? swfCSS.swfTimedout : swfCSS.swfError);
     }

     processOnEvents({
       type: 'ontimeout',
       error: error,
       ignoreInit: true
     });

     debugTS('onload', false);
     catchError(error);

     result = false;

   } else {

     debugTS('onload', true);

   }

   if (!disabled) {

     if (sm2.waitForWindowLoad && !windowLoaded) {

       _wDS('waitOnload');
       event.add(window, 'load', initUserOnload);

     } else {

       // <d>
       if (sm2.waitForWindowLoad && windowLoaded) {
         _wDS('docLoaded');
       }
       // </d>

       initUserOnload();

     }

   }

   return result;

 };

 /**
  * apply top-level setupOptions object as local properties, eg., this.setupOptions.flashVersion -> this.flashVersion (soundManager.flashVersion)
  * this maintains backward compatibility, and allows properties to be defined separately for use by soundManager.setup().
  */

 setProperties = function() {

   var i,
       o = sm2.setupOptions;

   for (i in o) {

     if (o.hasOwnProperty(i)) {

       // assign local property if not already defined

       if (sm2[i] === _undefined) {

         sm2[i] = o[i];

       } else if (sm2[i] !== o[i]) {

         // legacy support: write manually-assigned property (eg., soundManager.url) back to setupOptions to keep things in sync
         sm2.setupOptions[i] = sm2[i];

       }

     }

   }

 };


 init = function() {

   // called after onload()

   if (didInit) {
     _wDS('didInit');
     return false;
   }

   function cleanup() {
     event.remove(window, 'load', sm2.beginDelayedInit);
   }

   if (sm2.html5Only) {

     if (!didInit) {
       // we don't need no steenking flash!
       cleanup();
       sm2.enabled = true;
       initComplete();
     }

     return true;

   }

   // flash path
   initMovie();

   try {

     // attempt to talk to Flash
     flash._externalInterfaceTest(false);

     /**
      * Apply user-specified polling interval, OR, if "high performance" set, faster vs. default polling
      * (determines frequency of whileloading/whileplaying callbacks, effectively driving UI framerates)
      */
     setPolling(true, (sm2.flashPollingInterval || (sm2.useHighPerformance ? 10 : 50)));

     if (!sm2.debugMode) {
       // stop the SWF from making debug output calls to JS
       flash._disableDebug();
     }

     sm2.enabled = true;
     debugTS('jstoflash', true);

     if (!sm2.html5Only) {
       // prevent browser from showing cached page state (or rather, restoring "suspended" page state) via back button, because flash may be dead
       // http://www.webkit.org/blog/516/webkit-page-cache-ii-the-unload-event/
       event.add(window, 'unload', doNothing);
     }

   } catch(e) {

     sm2._wD('js/flash exception: ' + e.toString());

     debugTS('jstoflash', false);

     catchError({
       type: 'JS_TO_FLASH_EXCEPTION',
       fatal: true
     });

     // don't disable, for reboot()
     failSafely(true);

     initComplete();

     return false;

   }

   initComplete();

   // disconnect events
   cleanup();

   return true;

 };

 domContentLoaded = function() {

   if (didDCLoaded) return false;

   didDCLoaded = true;

   // assign top-level soundManager properties eg. soundManager.url
   setProperties();

   initDebug();

   if (!hasFlash && sm2.hasHTML5) {

     sm2._wD('SoundManager 2: No Flash detected' + (!sm2.useHTML5Audio ? ', enabling HTML5.' : '. Trying HTML5-only mode.'), 1);

     sm2.setup({
       useHTML5Audio: true,
       // make sure we aren't preferring flash, either
       // TODO: preferFlash should not matter if flash is not installed. Currently, stuff breaks without the below tweak.
       preferFlash: false
     });

   }

   testHTML5();

   if (!hasFlash && needsFlash) {

     messages.push(strings.needFlash);

     // TODO: Fatal here vs. timeout approach, etc.
     // hack: fail sooner.
     sm2.setup({
       flashLoadTimeout: 1
     });

   }

   if (doc.removeEventListener) {
     doc.removeEventListener('DOMContentLoaded', domContentLoaded, false);
   }

   initMovie();

   return true;

 };

 domContentLoadedIE = function() {

   if (doc.readyState === 'complete') {
     domContentLoaded();
     doc.detachEvent('onreadystatechange', domContentLoadedIE);
   }

   return true;

 };

 winOnLoad = function() {

   // catch edge case of initComplete() firing after window.load()
   windowLoaded = true;

   // catch case where DOMContentLoaded has been sent, but we're still in doc.readyState = 'interactive'
   domContentLoaded();

   event.remove(window, 'load', winOnLoad);

 };

 // sniff up-front
 detectFlash();

 // focus and window load, init (primarily flash-driven)
 event.add(window, 'focus', handleFocus);
 event.add(window, 'load', delayWaitForEI);
 event.add(window, 'load', winOnLoad);

 if (doc.addEventListener) {

   doc.addEventListener('DOMContentLoaded', domContentLoaded, false);

 } else if (doc.attachEvent) {

   doc.attachEvent('onreadystatechange', domContentLoadedIE);

 } else {

   // no add/attachevent support - safe to assume no JS -> Flash either
   debugTS('onload', false);
   catchError({
     type: 'NO_DOM2_EVENTS',
     fatal: true
   });

 }

} // SoundManager()

// SM2_DEFER details: http://www.schillmania.com/projects/soundmanager2/doc/getstarted/#lazy-loading

if (window.SM2_DEFER === _undefined || !SM2_DEFER) {
 soundManager = new SoundManager();
}

/**
* SoundManager public interfaces
* ------------------------------
*/

if (typeof module === 'object' && module && typeof module.exports === 'object') {

 /**
  * commonJS module
  */

 module.exports.SoundManager = SoundManager;
 module.exports.soundManager = soundManager;

} else if (typeof define === 'function' && define.amd) {

 /**
  * AMD - requireJS
  * basic usage:
  * require(["/path/to/soundmanager2.js"], function(SoundManager) {
  *   SoundManager.getInstance().setup({
  *     url: '/swf/',
  *     onready: function() { ... }
  *   })
  * });
  *
  * SM2_DEFER usage:
  * window.SM2_DEFER = true;
  * require(["/path/to/soundmanager2.js"], function(SoundManager) {
  *   SoundManager.getInstance(function() {
  *     var soundManager = new SoundManager.constructor();
  *     soundManager.setup({
  *       url: '/swf/',
  *       ...
  *     });
  *     ...
  *     soundManager.beginDelayedInit();
  *     return soundManager;
  *   })
  * });
  */

 define(function() {
   /**
    * Retrieve the global instance of SoundManager.
    * If a global instance does not exist it can be created using a callback.
    *
    * @param {Function} smBuilder Optional: Callback used to create a new SoundManager instance
    * @return {SoundManager} The global SoundManager instance
    */
   function getInstance(smBuilder) {
     if (!window.soundManager && smBuilder instanceof Function) {
       var instance = smBuilder(SoundManager);
       if (instance instanceof SoundManager) {
         window.soundManager = instance;
       }
     }
     return window.soundManager;
   }
   return {
     constructor: SoundManager,
     getInstance: getInstance
   };
 });

}

// standard browser case

// constructor
window.SoundManager = SoundManager;

/**
* note: SM2 requires a window global due to Flash, which makes calls to window.soundManager.
* Flash may not always be needed, but this is not known until async init and SM2 may even "reboot" into Flash mode.
*/

// public API, flash callbacks etc.
window.soundManager = soundManager;

}(window));
