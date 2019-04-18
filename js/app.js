/* global $SD */
$SD.on('connected', conn => connected(conn));

function connected (jsn) {
    debugLog('Connected Plugin:', jsn);

    /** subscribe to the willAppear event */
    $SD.on('com.adm.cdwn.action.willAppear', jsonObj =>
        action.onWillAppear(jsonObj)
    );
    $SD.on('com.adm.cdwn.action.willDisappear', jsonObj =>
        action.onWillDisappear(jsonObj)
    );
    $SD.on('com.adm.cdwn.action.keyUp', jsonObj =>
        action.onKeyUp(jsonObj)
    );
    $SD.on('com.adm.cdwn.action.sendToPlugin', jsonObj =>
        action.onSendToPlugin(jsonObj)
    );
}

var action = {
    type: 'com.adm.cdwn.action',
    cache: {},
	

    getContextFromCache: function (ctx) {
        return this.cache[ctx];
    },

    onWillAppear: function (jsn) {

        if (!jsn.payload || !jsn.payload.hasOwnProperty('settings')) return;

        const clockIndex = jsn.payload.settings['clock_index'] || 0;
		var timerTypeIdx = jsn.payload.settings['timerIndex'] || 0;
		//var 
        const clock = new AnalogClock(jsn);

        clock.setClockFaceNum(clockIndex);
		clock.setClockTypeNum(timerTypeIdx);
        clock.toggleClock();

        // cache the current clock
        this.cache[jsn.context] = clock;

        $SD.api.setSettings(jsn.context, {
            context: jsn.context,
            clock_index: clockIndex
        });

        $SD.api.sendToPropertyInspector(
            jsn.context,
            { clock_index: clockIndex },
            this.type
        );
    },

    onWillDisappear: function (jsn) {
        let found = this.getContextFromCache(jsn.context);
        if (found) {
            // remove the clock from the cache
            found.destroyClock();
            delete this.cache[jsn.context];
        }
    },

    onKeyUp: function (jsn) {
        const clock = this.getContextFromCache(jsn.context);
        /** Edge case +++ */
        if (!clock) this.onWillAppear(jsn);
        else clock.resetCountdown();
    },

    onSendToPlugin: function (jsn) {
        //console.log('--- OnSendToPlugin ---', jsn, jsn.payload);
        if (!jsn.payload) return;
        let clockIndex = 0;
		let timerIDX = 0;
        const clock = this.getContextFromCache(jsn.context);

        if (jsn.payload.hasOwnProperty('DATAREQUEST')) {
            if (clock && clock.isDemo()) {
                const arrDemoClock = clockfaces.filter(e => e.demo); // find demo-clock definition
                clockIndex = arrDemoClock ? clockfaces.indexOf(arrDemoClock[0]) : 0;
            } else if (clock) {
                clockIndex = clock.currentClockFaceIdx || 0;
            }

            $SD.api.sendToPropertyInspector(
                jsn.context,
                { clock_index: clockIndex,
				timerType: timerIDX },
                this.type
            );
        } else { 
			if (jsn.payload.hasOwnProperty('clock_index')) { /* if there's no clock-definitions, so simply do nothing */
				/* set the appropriate clockface index as choosen from the popupmenu in PI */
				const clockIdx = Number(jsn.payload['clock_index']);
				$SD.api.setSettings(jsn.context, {
					context: jsn.context,
					clock_index: clockIdx
				});

            if (clock) {
                clock.setClockFaceNum(clockIdx);
                this.cache[jsn.context] = clock;
            } }//ifJSNhasOWNprop
			if(jsn.payload.hasOwnProperty('timerIndex')) {
				console.log("got the updated PI event");
				$SD.api.setSettings(jsn.context, {
					context: jsn.context,
					timerType: Number(jsn.payload['timerIndex'])
				});
				if (clock) { //if the clock exists, update the clocktype number
				console.log("clock exists, updating type");
					clock.setClockTypeNum(Number(jsn.payload['timerIndex']));
					this.cache[jsn.context] = clock; //save the clock
				}					
			}//ifJSNpropTimertype
			
			}//else
    }
};


function AnalogClock (jsonObj) {
    var jsn = jsonObj,
        context = jsonObj.context,
        clockTimer = 0,
        clock = null,
        clockface = clockfaces[0],
        currentClockFaceIdx = 0,
		timerType = timerTypes[0],
		timerTypeIdx = 0,
        origContext = jsonObj.context,
        canvas = null,
        demo = false,
        count = Math.floor(Math.random() * Math.floor(10));


    function isDemo () {
        return demo;
    }

    function createClock (settings) {
        canvas = document.createElement('canvas');
        canvas.width = 144;
        canvas.height = 144;
        clock = new Clock(canvas);
        clock.setColors(clockface.colors);
		
		clock.setTimer(timerTypes[timerTypeIdx].max_time);
		clock.setType(timerTypes[timerTypeIdx].arcColour);
    }
	
	function resetCountdown() {
		clock.resetCountdown();
		
	}//resetCountdown()
	

    function toggleClock () {

        if (clockTimer === 0) {
            clockTimer = setInterval(function (sx) {

                if (demo) {
                    let c = -1;
                    if (count % 21 == 6) {
                        c = 0;
                    } else if (count % 21 === 3) {
                        c = 1;
                    } else if (count % 21 === 9) {
                        c = 2;
                    } else if (count % 21 === 12) {
                        c = 3;
                    } else if (count % 21 === 15) {
                        c = 4;
                    } else if (count % 21 === 18) {
                        c = 5;
                    }

                    if (c !== -1) {
                        setClockFaceNum(c, demo);
                    } else {
                        drawClock();
                    }
                } else {
                    drawClock();
                }

                count++;
            }, 1000);
        } else {
            window.clearInterval(clockTimer);
            clockTimer = 0;
        }
    }

    function drawClock (jsn) {
        clock.drawClock();
        $SD.api.setImage(
            context,
            clock.getImageData()
        );
    }

    function setClockFace (newClockFace, isDemo) {
        clockface = newClockFace;
        demo = clockface.demo || isDemo;
        clock.setColors(clockface.colors);
        clockface.text !== true && $SD.api.setTitle(context, '', null);
        drawClock();
    }

    function setClockFaceNum (idx, isDemo) {
        currentClockFaceIdx = idx < clockfaces.length ? idx : 0;
        this.currentClockFaceIdx = currentClockFaceIdx;
        setClockFace(clockfaces[currentClockFaceIdx], isDemo);
    }
	
	
	
	
	
	function setClockType (newTimerType) {
		/*a new timer type has been selected from the PI*/
        let timerType = newTimerType;
        clock.setType(timerType.arcColour);
		clock.setTimer(timerType.max_time);
		clock.resetCountdown();
        drawClock();
    }

    function setClockTypeNum (idx) {
		/*get the index number of the clock type*/
        let currentClockTypeIdx= idx < timerTypes.length ? idx : 0;
        this.timerTypeIdx = currentClockTypeIdx;
        setClockType(timerTypes[currentClockTypeIdx]);
    }
	
	
	
	
	
	
	
	

    function destroyClock () {
        if (clockTimer !== 0) {
            window.clearInterval(clockTimer);
            clockTimer = 0;
        }
    }

    createClock();

    return {
        clock: clock,
        clockTimer: clockTimer,
        clockface: clockface,
        currentClockFaceIdx: currentClockFaceIdx,
        name: name,
        drawClock: drawClock,
        toggleClock: toggleClock,
        origContext: origContext,
        setClockFace: setClockFace,
        setClockFaceNum: setClockFaceNum,
		setClockType: setClockType,
		setClockTypeNum: setClockTypeNum,
        destroyClock: destroyClock,
        demo: demo,
		resetCountdown: resetCountdown,
        isDemo: isDemo
    };
}
