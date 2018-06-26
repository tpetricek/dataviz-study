#if INTERACTIVE
#r "System.Xml.Linq.dll"
#r "../packages/DotLiquid/lib/net451/DotLiquid.dll"
#r "../packages/Suave/lib/net40/Suave.dll"
#r "../packages/Suave.DotLiquid/lib/net40/Suave.DotLiquid.dll"
#else
module Server
#endif
open Suave
open System
open Suave.Filters
open Suave.Writers
open Suave.Operators

let (</>) a b = IO.Path.Combine(a, b)
let asm, debug = 
  if System.Reflection.Assembly.GetExecutingAssembly().IsDynamic then __SOURCE_DIRECTORY__, true
  else IO.Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location), false
let root = IO.Path.GetFullPath(asm </> ".." </> "web")
let templ = IO.Path.GetFullPath(asm </> ".." </> "templates")

DotLiquid.setTemplatesDir templ 
DotLiquid.setCSharpNamingConvention()

type Step2 = 
  { ProlificId : string 
    Education : string
    Studying : bool }

type Step5 = 
  { Question1 : string 
    Share1 : int
    Question2 : string
    Share2 : int }

let parseStep2 form = 
  let form = Map.ofSeq (List.choose (function (k, None) -> None | (k, Some v) -> Some(k, v)) form)
  { ProlificId = defaultArg (form.TryFind "prolificid") "missing"
    Education = defaultArg (form.TryFind "education") "missing"
    Studying = form.TryFind "student" = Some "on" }

let parseStep5 form = 
  let form = Map.ofSeq (List.choose (function (k, None) -> None | (k, Some v) -> Some(k, v)) form)
  { Question1 = defaultArg (form.TryFind "question1") "missing"
    Question2 = defaultArg (form.TryFind "question2") "missing"
    Share1 = defaultArg (Option.map int (form.TryFind "share1")) 0
    Share2 = defaultArg (Option.map int (form.TryFind "share2")) 0 }

// When we get POST request to /log, write the received 
// data to the log blob (on a single line)
let app = request (fun r ->
  choose [
    path "/" >=> DotLiquid.page "step1.html" null
    path "/step2" >=> DotLiquid.page "step2.html" null
    path "/step3" >=> DotLiquid.page "step3.html" (parseStep2 r.form)
    path "/step4" >=> DotLiquid.page "step4.html" null
    path "/step5" >=> DotLiquid.page "step5.html" null
    path "/step6" >=> DotLiquid.page "step6.html" (parseStep5 r.form)
    Files.browse root
  ])

//  request (fun req ->
//    let pid = req.query |> Seq.tryPick (fun (k, v) -> if k = "pid" then v else None)
//    match pid with 
//    | Some pid -> Successful.OK ("Hello " + pid + "<br /><a href='https://app.prolific.ac/submissions/complete?cc=LZO66C0G'>Finish...</a>")
//    | _ -> Successful.OK "No pid..."
//  )

// When port was specified, we start the app (in Azure), 
// otherwise we do nothing (it is hosted by 'build.fsx')
match System.Environment.GetCommandLineArgs() |> Seq.tryPick (fun s ->
    if s.StartsWith("port=") then Some(int(s.Substring("port=".Length)))
    else None ) with
| Some port ->
    let serverConfig =
      { Web.defaultConfig with
          logger = Logging.Targets.create Logging.LogLevel.Info [||]
          homeFolder = Some __SOURCE_DIRECTORY__
          bindings = [ HttpBinding.createSimple HTTP "127.0.0.1" port ] }
    Web.startWebServer serverConfig app
| _ -> ()