package main

import (
  "bytes"
  "crypto/rand"
  "crypto/sha256"
  "encoding/hex"
  "encoding/json"
  "fmt"
  "io"
  "net/http"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "strings"
  "time"
)

type Config struct { Worker, ServerID, AgentToken string }
type Heartbeat struct { Hostname string `json:"hostname"`; OS string `json:"os"`; Arch string `json:"arch"`; Xray string `json:"xray"`; Version string `json:"version"`; Uptime int64 `json:"uptime"` }
type Command struct { ID string `json:"id"`; Action string `json:"action"`; Args map[string]interface{} `json:"args"` }

const configPath = "/usr/local/vless-agent/config.json"
const xrayConfig = "/usr/local/etc/xray/config.json"

func main(){
  cfg,err:=loadConfig();if err!=nil{panic(err)}
  for { heartbeat(cfg); poll(cfg); time.Sleep(2*time.Second) }
}
func loadConfig()(*Config,error){b,e:=os.ReadFile(configPath);if e!=nil{return nil,e};var c Config;e=json.Unmarshal(b,&c);return &c,e}
func request(cfg *Config, method,path string, body []byte)([]byte,error){req,e:=http.NewRequest(method,strings.TrimRight(cfg.Worker,"/")+path,bytes.NewReader(body));if e!=nil{return nil,e};req.Header.Set("Authorization","Bearer "+cfg.AgentToken);if len(body)>0{req.Header.Set("Content-Type","application/json")};r,e:=http.DefaultClient.Do(req);if e!=nil{return nil,e};defer r.Body.Close();out,_:=io.ReadAll(r.Body);if r.StatusCode>=300{return out,fmt.Errorf("http %d: %s",r.StatusCode,string(out))};return out,nil}
func heartbeat(cfg *Config){h,_:=os.Hostname(); x:="stopped";v:="";if _,e:=os.Stat(xrayConfig);e==nil{x="installed";v=xrayVersion()};b,_:=json.Marshal(Heartbeat{h,runtime.GOOS,runtime.GOARCH,x,v,time.Now().Unix()});request(cfg,"POST","/api/agent/"+cfg.ServerID+"/heartbeat",b)}
func poll(cfg *Config){b,e:=request(cfg,"GET","/api/agent/"+cfg.ServerID+"/poll",nil);if e!=nil{return};var r struct{Command *Command `json:"command"`};if json.Unmarshal(b,&r)==nil&&r.Command!=nil{runCommand(r.Command)}}
func runCommand(c *Command){switch c.Action{case "restart_xray": exec.Command("systemctl","restart","xray").Run();case "stop_xray":exec.Command("systemctl","stop","xray").Run();case "start_xray":exec.Command("systemctl","start","xray").Run();case "xray_update":exec.Command("bash","-lc","curl -fsSL https://github.com/XTLS/Xray-install/raw/main/install-release.sh | bash").Run()}}
func xrayVersion()string{out,e:=exec.Command("xray","version").Output();if e!=nil{return ""};return strings.TrimSpace(string(out))}
func randomHex(n int)string{b:=make([]byte,n);rand.Read(b);return hex.EncodeToString(b)}
func tokenHash(s string)string{h:=sha256.Sum256([]byte(s));return hex.EncodeToString(h[:])}
func ensureDirs(){os.MkdirAll(filepath.Dir(configPath),0755);os.MkdirAll(filepath.Dir(xrayConfig),0755)}
