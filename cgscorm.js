// SCORM 1.2 SCO Logic management script sample
// Copyright 2001,2002,2003 Click2learn, Inc.
// This rev concocted by Claude Ostyn 2003-02-22 
// Mods by Dave Beaumont, Connected Learning Ltd, 10/8/04

var g_bShowApiErrors = false;
var g_bShowFirstError = true;
var g_strAPINotFound = "Management system interface not found. Progress will not be saved.";
var g_strAPITooDeep = "Cannot find API - too deeply nested.";
var g_strAPIInitFailed = "Found API but LMSInitialize failed.";
var g_strAPISetError = "Trying to set value but API not available.";

var g_bMasteryScoreInitialized = false;

/////////// API INTERFACE INITIALIZATION AND CATCHER FUNCTIONS ////////
var g_nFindAPITries = 0;
var g_objAPI = null;
var g_bInitDone = false;
var g_bFinishDone = false;
var	g_bSCOBrowse = false;
var g_dtmInitialized = new Date(); // will be adjusted after initialize

function AlertUserOfAPIError(strText) {
	if ((g_bShowApiErrors) || (g_bShowFirstError))
		{
			alert(strText);
			g_bShowFirstError = false;
		}
}

function FindAPI(win) {
	while ((win.API == null) && (win.parent != null) && (win.parent != win)) {
		g_nFindAPITries ++;
		if (g_nFindAPITries > 500) {
			AlertUserOfAPIError(g_strAPITooDeep);
			return null;
		} 
		win = win.parent;
	}
	return win.API;
}

function APIOK() {
	return ((typeof(g_objAPI)!= "undefined") && (g_objAPI != null))
}

function SCOInitialize() {
	var err = true;
	if (!g_bInitDone) {
		if ((window.parent) && (window.parent != window)){
			g_objAPI = FindAPI(window.parent)
		}
		if ((g_objAPI == null) && (window.opener != null))	{
			g_objAPI = FindAPI(window.opener)
		}
		if (!APIOK()) {
			AlertUserOfAPIError(g_strAPINotFound);
			err = false
		} else {
			err =  g_objAPI.LMSInitialize("");
			if (err == "true") {
				g_bSCOBrowse = (g_objAPI.LMSGetValue("cmi.core.lesson_mode") == "browse");						
				if (!g_bSCOBrowse) {
					if (g_objAPI.LMSGetValue("cmi.core.lesson_status") == "not attempted") {
						err =  g_objAPI.LMSSetValue("cmi.core.lesson_status","incomplete")
					}
				}
			} else {
				AlertUserOfAPIError(g_strAPIInitFailed)
			}
		}
	}
	if (typeof(SCOInitData) != "undefined") {
		// The SCOInitData function can be defined in another script of the SCO
		SCOInitData()
	}
	g_dtmInitialized = new Date();
	return (err + "") // Force type to string
}

function SCOFinish() {
	if ((APIOK()) && (g_bFinishDone == false)) {
		if (typeof(SCOSaveData) != "undefined"){
			SCOReportSessionTime()
			// The SCOSaveData function can be defined in another script of the SCO
			SCOSaveData();
		}
		g_bFinishDone = (g_objAPI.LMSFinish("") == "true");
	}
	return (g_bFinishDone + "" ) // Force type to string
}

// Call these catcher functions rather than trying to call the API adapter directly
function SCOGetValue(nam)			{return ((APIOK())?g_objAPI.LMSGetValue(nam.toString()):"")}
function SCOCommit(parm)			{return ((APIOK())?g_objAPI.LMSCommit(""):"false")}
function SCOGetLastError(parm){return ((APIOK())?g_objAPI.LMSGetLastError(""):"-1")}
function SCOGetErrorString(n)	{return ((APIOK())?g_objAPI.LMSGetErrorString(n):"No API")}
function SCOGetDiagnostic(p)	{return ((APIOK())?g_objAPI.LMSGetDiagnostic(p):"No API")}

//LMSSetValue is implemented with more complex data
//management logic below

var g_bMinScoreAcquired = false;
var g_bMaxScoreAcquired = false;

// Special logic begins here
function SCOSetValue(nam,val){
	var err = "";
	if (!APIOK()){
			AlertUserOfAPIError(g_strAPISetError + "\n" + nam + "\n" + val);
			err = "false"
	} else if (nam == "cmi.core.score.raw") err = privReportRawScore(val)
	if (err == ""){
			err =  g_objAPI.LMSSetValue(nam,val.toString() + "");
			if (err != "true") return err
	}
	if (nam == "cmi.core.score.min"){
		g_bMinScoreAcquired = true;
		g_nSCO_ScoreMin = val
	}
	else if (nam == "cmi.core.score.max"){
		g_bMaxScoreAcquired = true;
		g_nSCO_ScoreMax = val
	}
	return err
}
function privReportRawScore(nRaw) { // called only by SCOSetValue
	if (isNaN(nRaw)) return "false";
	if (!g_bMinScoreAcquired){
		if (g_objAPI.LMSSetValue("cmi.core.score.min",g_nSCO_ScoreMin+"")!= "true") return "false"
	}
	if (!g_bMaxScoreAcquired){
		if (g_objAPI.LMSSetValue("cmi.core.score.max",g_nSCO_ScoreMax+"")!= "true") return "false"
	}
	if (g_objAPI.LMSSetValue("cmi.core.score.raw", nRaw)!= "true")	return "false";
	g_bMinScoreAcquired = false;
	g_bMaxScoreAcquired = false;
	if (!g_bMasteryScoreInitialized){
		var nMasteryScore = parseInt(SCOGetValue("cmi.student_data.mastery_score"),10);
		if (!isNaN(nMasteryScore)) g_SCO_MasteryScore = nMasteryScore
  }
	if (isNaN(g_SCO_MasteryScore)) return "false";
	var stat = (nRaw >= g_SCO_MasteryScore? "passed" : "failed");
	if (SCOSetValue("cmi.core.lesson_status",stat) != "true") return "false";
	return "true"
}

function MillisecondsToCMIDuration(n) {
//Convert duration from milliseconds to 0000:00:00.00 format
	var hms = "";
	var dtm = new Date();	dtm.setTime(n);
	var h = "000" + Math.floor(n / 3600000);
	var m = "0" + dtm.getMinutes();
	var s = "0" + dtm.getSeconds();
	var cs = "0" + Math.round(dtm.getMilliseconds() / 10);
	hms = h.substr(h.length-4)+":"+m.substr(m.length-2)+":";
	hms += s.substr(s.length-2)+"."+cs.substr(cs.length-2);
	return hms
}

// SCOReportSessionTime is called automatically by this script,
// but you may call it at any time also from the SCO
function SCOReportSessionTime() {
	var dtm = new Date();
	var n = dtm.getTime() - g_dtmInitialized.getTime();
	return SCOSetValue("cmi.core.session_time",MillisecondsToCMIDuration(n))
}

// Since only the designer of a SCO knows what completed means, another
// script of the SCO may call this function to set completed status. 
// The function checks that the SCO is not in browse mode, and 
// avoids clobbering a "passed" or "failed" status since they imply "completed".
function SCOSetStatusCompleted(){
	var stat = SCOGetValue("cmi.core.lesson_status");
	if (SCOGetValue("cmi.core.lesson_mode") != "browse"){
		if ((stat!="completed") && (stat != "passed") && (stat != "failed")){
			return SCOSetValue("cmi.core.lesson_status","completed")
		}
	} else return "false"
}


//Navigation functions extracted from cgstage:
//*******************************************

function GoToPage(n) {
  if ((!isNaN(n)) && (n >= 1) && (n <= znNavigablePages)){
  	if (n < 10) { cg_stage.location.href = cgPageRoot + "_0" + n + ".html" };
  	if (n >= 10) { cg_stage.location.href = cgPageRoot + "_" + n + ".html" };
  }
  else if ((!isNaN(n)) && (n == 0)){
  	cg_stage.location.href = "index.html";
  }
}

function SetThisPage(n) { // called by each navigable page when displayed
  var i = 0; var nCnt = 0;
  znThisPage = n;
  zaVisitedPages[n] = true;
  for (i = 1 ; i < znNavigablePages+1; i++){
    if (zaVisitedPages[i]) { nCnt++ }
  }
  zaSuspendData = zaVisitedPages.join(",");
  znSuspendLocation = znThisPage;
  
  if (nCnt == znNavigablePages) {
     SCOSetStatusCompleted();
     zaSuspendStatus = "";
     znSuspendLocation = "";
     zaSuspendData = "";
  }
  
  // Make sure this is recorded, just in case
  SCOSetValue("cmi.core.exit", zaSuspendStatus);
  SCOSetValue("cmi.core.lesson_location", znSuspendLocation);
  SCOSetValue("cmi.suspend_data", zaSuspendData);
  SCOCommit();
}

function SCOInitData() {
  // this function will be called when this SCO is loaded
	var loc = znStartPage;
  	if ((SCOGetValue("cmi.core.entry") != "ab-initio") && (SCOGetValue("cmi.core.lesson_status") != "completed")){
    	var SuspendData = SCOGetValue("cmi.suspend_data");
    	if (SuspendData.length > 0) {
      		zaVisitedPages = SuspendData.split(",")
    	}
    	var loc =(parseInt(SCOGetValue("cmi.core.lesson_location")));
		if (isNaN(loc)) { loc = znStartPage; }
  	}
	GoToPage(loc);
}

function SCOSaveData(){
  // this function will be called when this SCO is unloaded
  	SCOSetValue("cmi.core.exit", zaSuspendStatus);
  	SCOSetValue("cmi.core.lesson_location", znSuspendLocation);
  	SCOSetValue("cmi.suspend_data", zaSuspendData);
  	SCOCommit();
}


//Assessment functions extracted from cgstage:
//*******************************************

function initArray(anArray, aValue) {
	for (var i=0;i<anArray.length;i++) { 
		anArray[i] = aValue;
	}
}

function storeScore(q,s) {
	znQuestionScores[q] = s;
	var t = sumScores(znQuestionScores);
	// alert("storeScore: Qn" + q + ", Score " + t + ", Array " +  znQuestionScores.join(","));
	SCOSetValue("cmi.core.score.raw", t); 
	SCOCommit();
}

function sumScores(scoreArray) {
	var sum = 0;
	for (var i=0;i<scoreArray.length;i++) {
		sum = sum + scoreArray[i];
		}
	return sum;
}
	
function resetError() {
	// Allows the next error message to be output, to enable feedback from UI Events (such as saving a question respomse)
	g_bShowFirstError = true;
	return;
}