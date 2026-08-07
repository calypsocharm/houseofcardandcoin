using System;
using System.IO;
class Askpass{ static void Main(string[] a){ try{ string dir=AppContext.BaseDirectory; string[] lines=File.ReadAllLines(Path.Combine(dir,".hocc-vps-secret")); if(lines.Length>0) Console.Write(lines[0].Trim()); }catch{} } }