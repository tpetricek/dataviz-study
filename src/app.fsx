#if INTERACTIVE
#r "System.Xml.Linq.dll"
open Suave.Classic.Suave.Http
#r "../packages/Suave/lib/net40/Suave.dll"
#else
module Server
#endif
open Suave
open System
open Suave.Filters
open Suave.Writers
open Suave.Operators

// When we get POST request to /log, write the received 
// data to the log blob (on a single line)
let app =
  request (fun req ->
    let pid = req.query |> Seq.tryPick (fun (k, v) -> if k = "pid" then v else None)
    match pid with 
    | Some pid -> Successful.OK ("Hello " + pid)
    | _ -> Successful.OK "No pid..."
  )

// When port was specified, we start the app (in Azure), 
// otherwise we do nothing (it is hosted by 'build.fsx')
match System.Environment.GetCommandLineArgs() |> Seq.tryPick (fun s ->
    if s.StartsWith("port=") then Some(int(s.Substring("port=".Length)))
    else None ) with
| Some port ->
    let serverConfig =
      { Web.defaultConfig with
          logger = Logging.Loggers.saneDefaultsFor Logging.LogLevel.Warn
          bindings = [ HttpBinding.mkSimple HTTP "127.0.0.1" port ] }
    Web.startWebServer serverConfig app
| _ -> ()