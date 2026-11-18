CS405 Lab 6 — NPR post-processing passes in Three.js (r187) and TSL

1. In this folder start a local web server (ES modules do not load from file://):
     npx serve                      then open http://localhost:3000
   or
     python3 -m http.server 8000    then open http://localhost:8000
2. Use a browser with WebGPU (current Chrome or Edge). The line at the bottom of the page
   should read "backend: WebGPU · three.js r187".
3. Edit effects.js only (TODO 1–8). Save and reload. Keys 0–8 switch effects;
   the split slider shows the plain render on the left and your effect on the right.

three.js r187 (MIT licence) is included in vendor/, so no internet connection is needed.
The painting on the wall: Fausto Zonaro, Mehtap (1892), Sakıp Sabancı Museum.
