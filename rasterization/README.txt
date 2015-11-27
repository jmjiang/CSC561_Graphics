1. How to run:
   The cube2 object will be loaded as default when double clicking index.html.
   There are three objects included in the submission folder: cube2, vase, and head.
   To load vase, append "?objfilepath=objs/vase/vase.obj" at the end of the original URL.
   To load head, append "?objfilepath=objs/head/head.obj" at the end of the original URL.
   NOTE: head object takes a long time to load. So if Chrome asks you to wait or kill, please wait. It will show up.

2. Required functionalities:
	All DONE.

3. Extra Credit: 
   a. Arbitrarily sized interface windows:
	DONE. Change the window size by typing the width and height in the text boxes on screen. The default width and height is 256 pixels.
   b. Multiple and arbitrarily located lights
   	DONE. The lights.txt file is included in objs folder. The lights file's URL is hardcoded in index.html.
	      There are two lights specified in lights.txt file. The second one is set to white. Feel free to modify it.
	      To add or delete a light, delete all the five lines that specify the light. ALSO, change NUM_LIGHTS in index.html accordingly.
   c. Multiple image formats
   	DONE. A .jpg file is included in objs/vase folder. And the jpg image is loaded as the default texture of vase as specified in vase.mtl.
   d. Alpha test
   	DONE. The pixels are not drawn when its alpha is smaller than 0.5. 
	      Did not demonstrate it in the code...
