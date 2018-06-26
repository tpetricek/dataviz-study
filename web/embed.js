// ----------------------------------------------------------------------------------------
// Logging user events
// ----------------------------------------------------------------------------------------

function guid(){
  var d = new Date().getTime();
  if (window.performance && typeof window.performance.now === "function") d += performance.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (d + Math.random()*16)%16 | 0;
      d = Math.floor(d/16);
      return (c=='x' ? r : (r&0x3|0x8)).toString(16);
  });
}

var ssid = guid();
var pendingEvents = [];
var logTimer = -1;

function writeLog(callback) {
  logTimer = -1;
  if (pendingEvents.length > 0) {
    var req = new XMLHttpRequest();
    req.open("POST", "https://thegamma-logs.azurewebsites.net/log/datavizstudy");
    req.send(pendingEvents.join("\n"));
    req.onreadystatechange = function () {
      if (req.readyState === 4 && req.status === 200) {
        if (callback) callback();
      }
    };
  }
  pendingEvents = [];
}

function logEvent(category, evt, id, data, callback) {
  var usrid = document.cookie.replace(/(?:(?:^|.*;\s*)thegammausrid\s*\=\s*([^;]*).*$)|^.*$/, "$1");
  if (usrid == "") {
    usrid = guid();
    document.cookie = "thegammausrid=" + usrid;
  }
  var logObj =
    { "user":usrid, "session":ssid,
      "time":(new Date()).toISOString(),
      "url":window.location.toString(),
      "element": id, "category": category, "event": evt, "data": data };
  
  console.log("%c[%s]: %s (%O)","color:blue", logObj.category, logObj.event, logObj)
  pendingEvents.push(JSON.stringify(logObj));
  if (logTimer != -1) clearTimeout(logTimer);
  if (callback) {
    writeLog(callback);
  } else {
    logTimer = setTimeout(writeLog, 1000);  
  }
}

// ----------------------------------------------------------------------------------------
// Creating The Gamma visualization
// ----------------------------------------------------------------------------------------

if (!thegammaInit) { var thegammaInit = false; }

var vsRoot = "https://thegamma.net/lib/thegamma-0.1/vs";
var theGammaRoot = "https://thegamma.net/lib/thegamma-0.1";
var editor;
var setSourceLookup = {};
var lastId;

// We're not using any framework here (to keep it self-contained),
// so the following implements simple dialog boxes for showing the code.
function openDialog(id) {
  logEvent("dialog", "open", id, "");  
  var code = document.getElementById(id + "-code").innerHTML;
  editor.setValue(code);
  lastId = id;
    
  document.getElementById("thegamma-update").onclick = function() {
    setSourceLookup[id](editor.getValue(), true);
    closeDialog();
    return false;
  }
  
  document.getElementById("thegamma-dialog").style.display="block";
  setTimeout(function() {
    document.getElementById("thegamma-dialog").style.opacity=1;
    document.getElementById("thegamma-dialog-window").style.top="0px";
  },1);
}

function closeDialog() {
  logEvent("dialog", "close", lastId, "");
  document.getElementById("thegamma-dialog").style.opacity=0;
  document.getElementById("thegamma-dialog-window").style.top="-500px";
  setTimeout(function() {
    document.getElementById("thegamma-dialog").style.display="none";
  },400)
}

//
function createExploreEditor(ctx) {
  ctx.errorsReported(function (errs) {
    var lis = errs.slice(0, 5).map(function (e) {
      return "<li><span class='err'>error " + e.number + "</span>" +
        "<span class='loc'>at line " + e.startLine + " col " + e.startColumn + "</span>: " +
        e.message;
    });
    var ul = "<ul>" + lis + "</ul>";
    document.getElementById("explore-ed-errors").innerHTML = ul;
  });

  var opts =
    { autoHeight: true,
      monacoOptions: function(m) {
        m.fontFamily = "Inconsolata";
        m.fontSize = 16;
        m.lineHeight = 20;
        m.lineNumbers = false;
      } };

  var code = document.getElementById("explore-demo").innerHTML;
  var editor = ctx.createEditor("explore-ed", code, opts);
  var changing = false;
  var changingLogTimer = -1;
  editor.getMonacoEditor().onDidChangeModelContent(function() {
    if (changing) return;
    if (changingLogTimer != -1) clearTimeout(changingLogTimer);
    changingLogTimer = setTimeout(function() {
      var id = document.getElementById("explore-samples").value;
      logEvent("explore", "code", id, {"code":editor.getValue()});
    }, 5000);
  })
  
  function loadSource(code) {
    var lines = code.trim().split(/\r\n|\r|\n/);
    changing = true;
    editor.setValue(code);
    editor.getMonacoEditor().focus();
    setTimeout(function() {
      editor.getMonacoEditor().setPosition({column:lines[lines.length-1].trimRight().length+1,lineNumber:lines.length});
    }, 500);
    changing = false;
  }
  loadSource(code);
  
  // Get editor text and run it on the main page
  var editorMode = true;
  var okbtn = document.getElementById('explore-ok');
  okbtn.onclick = function() { 
    editorMode = !editorMode;    
    if (editorMode) {
      logEvent("explore", "edit", "", "");
      okbtn.innerText = "Run and show"; 
      document.getElementById('explore-ed-wrapper').style.display = "block";
      document.getElementById('explore-out-wrapper').style.display = "none";
    } else { 
      okbtn.innerText = "Edit source code";
      document.getElementById('explore-ed-wrapper').style.display = "none";
      document.getElementById('explore-out-wrapper').style.display = "block";
      code = editor.getValue();
      logEvent("explore", "run", "", {"code":code});
      ctx.evaluate(code, "explore-out");
    }
  };
  
  var samples = "<option>Open sample visualization...</option>";
  thegamma.forEach(function (info) { 
    if (info.title) samples += "<option value='" + info.id + "-code'>" + info.title + "</option>"; });
  document.getElementById("explore-samples").innerHTML = samples;
  
  document.getElementById("explore-samples").onchange = function() {
    var id = document.getElementById("explore-samples").value;
    logEvent("explore", "select", id, "");  
    if (id != null && id != "") {
      var code = document.getElementById(id).innerHTML;
      loadSource(code);
      editorMode = false;
      okbtn.onclick();
    }
  };
}

function createSimpleEditor(ctx) {
  ctx.errorsReported(function (errs) {
    var lis = errs.slice(0, 5).map(function (e) {
      return "<li><span class='err'>error " + e.number + "</span>" +
        "<span class='loc'>at line " + e.startLine + " col " + e.startColumn + "</span>: " +
        e.message;
    });
    var ul = "<ul>" + lis + "</ul>";
    document.getElementById("simple-ed-errors").innerHTML = ul;
  });

  var opts =
    { autoHeight: true,
      monacoOptions: function(m) {
        m.fontFamily = "Inconsolata";
        m.fontSize = 16;
        m.lineHeight = 20;
        m.lineNumbers = false;
      } };

  var code = document.getElementById("simple-demo").innerHTML;
  ctx.evaluate(code, "simple-out");
  
  var editor = ctx.createEditor("simple-ed", code, opts);
  var changing = false;
  var changingLogTimer = -1;
  editor.getMonacoEditor().onDidChangeModelContent(function() {
    if (changing) return;
    if (changingLogTimer != -1) clearTimeout(changingLogTimer);
    changingLogTimer = setTimeout(function() {
      var id = document.getElementById("simple-samples").value;
      logEvent("explore", "code", id, {"code":editor.getValue()});
    }, 5000);
  })
  
  // Get editor text and run it on the main page
  var okbtn = document.getElementById('simple-ok');
  okbtn.onclick = function() { 
    code = editor.getValue();
    logEvent("explore", "run", "", {"code":code});
    ctx.evaluate(code, "simple-out");
    if (!code.endsWith(" ")) {
      changing = true; editor.setValue(code + " "); changing = false; 
    }
    
    var lines = code.trim().split(/\r\n|\r|\n/);
    editor.getMonacoEditor().setPosition({column:lines[lines.length-1].trimRight().length+1,lineNumber:lines.length+1});
  };
}

function evalSnippetsAndCreateEditor(ctx) {
  ctx.errorsReported(function (errs) {
    var lis = errs.slice(0, 5).map(function (e) {
      return "<li><span class='err'>error " + e.number + "</span>" +
        "<span class='loc'>at line " + e.startLine + " col " + e.startColumn + "</span>: " +
        e.message;
    });
    var ul = "<ul>" + lis + "</ul>";
    document.getElementById("thegamma-errors").innerHTML = ul;
  });
  
  // Specify options and create the editor
  var opts =
    { height: document.getElementById("thegamma-sizer").clientHeight-115,
      width: document.getElementById("thegamma-sizer").clientWidth-20,
      monacoOptions: function(m) {
        m.fontFamily = "Inconsolata";
        m.fontSize = 15;
        m.lineHeight = 20;
        m.lineNumbers = false;
      } };
  editor = ctx.createEditor("thegamma-ed", "", opts);

  // Go over all the visualizations as defined by 'var thegamma = [ .. ]' in the index.html file
  thegamma.forEach(function (info) {
    var id = info.id;

    // Set source code, evalate it and generate options for <select> elements
    // (only when there are placeholders and 'info.editors' is specified)
    function setSource(code, log, completed) {
      document.getElementById(id + "-code").innerHTML = code;
      
      if (log) logEvent("source", "update", id, code);
      ctx.evaluate(code).then(function(res) { 
        Object.keys(res).forEach(function(k) {
          var it = res[k];
          if (it && typeof it.setLogger === 'function') it = it.setLogger(function(o) { 
            logEvent("interactive", o.event, o.id, o.data);
          });
          if (it && typeof it.show === 'function') {
            if (completed) it.setInteractive(false).show("thegamma-" + id + "-out");
            else it.show("thegamma-" + id + "-out");
          }
        });
      });
      
      if (info.editors) {
        // Type check the source code & get result (as a JS promise)
        ctx.check(code).then(function(res) {
          if (res.wellTyped) {
            // If type checking succeeded, get all 'syntactic entities' in the typed code,
            // find all placeholders and generate <select> options for each placeholder
            res.getEntities()
              .filter(function(ent) { return ent.kind == "placeholder"; })
              .forEach(function(place) {
                var html = "";
                // Get the name of the selected member and other possible members
                // e.g. given `foo.[p:bar]`, selected will be "bar" and members
                // will be all other members that are available in `foo.<here>`
                var selected = place.getChildren()[0].getChildren()[1];
                place.getChildren()[0].getChildren()[0].type.members
                  .filter(function(m) { return m != "preview"; })
                  .forEach(function(m) {
                    var sel = m == selected.name ? " selected" : "";
                    html += "<option value='" + m + "'" + sel + ">" + m + "</option>";
                  });

                // Set elements of the drop down. When selection changes,
                // replace the placeholder in the source code with a new one.
                var drop = document.getElementById(info.editors + "-" + place.name);
                drop.onchange = function() {
                  var newCode = code.substr(0, place.range.start) +
                    "[" + place.name + ":'" + drop.value + "']" +
                    code.substr(place.range.end + 1);
                  logEvent("source", "select", id, {"placeholder":place.name, "value":drop.value});
                  setSource(newCode, true, false);
                };
                drop.innerHTML = html;
              });
          }
        });
      }
    }

    // Get and run default code, setup update handler
    setSourceLookup[id] = setSource;
    var code = document.getElementById(id + "-code").innerHTML;
    setSource(code, false, false);
  });
}

// When page loads - initialize all The Gamma visualizations
function loadTheGamma() {
  require.config({
    paths:{'vs':vsRoot},
    map:{ "*":{"monaco":"vs/editor/editor.main"}}
  });
  require(["vs/editor/editor.main", theGammaRoot + "/thegamma.js"], function (_, g) {
    var services = "https://thegamma-services.azurewebsites.net/";
    var gallery = "https://gallery-csv-service.azurewebsites.net/";
    var providers =
      g.providers.createProviders({
        "worldbank": g.providers.rest(services + "worldbank"),
        "libraries": g.providers.library(theGammaRoot + "/libraries.json"),
        "shared": g.providers.rest(gallery + "providers/listing", null, true),
        "web": g.providers.rest(gallery + "providers/data"),
        
        // Turing 2016/2017
        "people": g.providers.pivot(gallery + "providers/csv/2017-07-22/file_0.csv"),
        "views": g.providers.pivot(gallery + "providers/csv/2017-07-21/file_5.csv"),
        "videos": g.providers.pivot(gallery + "providers/csv/2017-05-29/file_1.csv"),
        "events": g.providers.pivot(gallery + "providers/csv/2017-07-03/file_2.csv"),
        "papers": g.providers.pivot(gallery + "providers/csv/2017-07-04/file_0.csv"),
        
        // shared.'by date'.'May 2017'.'The Alan Turing Institute People (7 May 2017)'
        "olympics": g.providers.pivot(services + "pdata/olympics"),
        "expenditure": g.providers.rest("https://thegamma-govuk-expenditure-service.azurewebsites.net/expenditure") 
      });
    
    evalSnippetsAndCreateEditor(g.gamma.createContext(providers));
    if (document.getElementById("explore-ed"))
      createExploreEditor(g.gamma.createContext(providers));
    if (document.getElementById("simple-ed"))
      createSimpleEditor(g.gamma.createContext(providers));
  });
}

// Generate HTML for each dialog box
function initTheGamma() {
  if (typeof(thegamma)==="undefined") return;
  thegamma.forEach(function(info) {
    var el = document.getElementById(info.id);
    if (info.inline) {
      el.innerHTML =
        ("<a href='javascript:openDialog(\"[ID]\")' title='Click here to see the calculation behind the number.' " +
            "class='thegamma-inline' id='thegamma-[ID]-out'>(...)</a>").replace(/\[ID\]/g, info.id);      
    } else {
      el.innerHTML =
        ("<div class='thegamma-edit'><a href='javascript:openDialog(\"[ID]\")'><i class='fa fa-code'></i> open source code</a></div>" +
        '<div id="thegamma-[ID]-out" class="thegamma-out"><p class="placeholder">Loading the visualization...</p></div>')
        .replace(/\[ID\]/g, info.id);
      }
  });
  loadTheGamma();
}

if (!thegammaInit) {
  thegammaInit=true;
  var ol = window.onload;
  window.onload = function() { initTheGamma(); if (ol) ol(); };
  var link = '<link href="https://thegamma.net/lib/thegamma-0.1/thegamma.css" rel="stylesheet">';
  var heads = document.getElementsByTagName("head");
  if (heads.length > 0) heads[0].innerHTML += link;
  else document.write(link);
}

var lastWinWidth = window.innerWidth;
window.onresize = function() { 
  var w = window.innerWidth;
  if (lastWinWidth != w) {
    lastWinWidth = w;
    Object.keys(setSourceLookup).forEach(function(id) {
      var code = document.getElementById(id + "-code").innerHTML;
      setSourceLookup[id](code, false, false);
    });
  }
}
