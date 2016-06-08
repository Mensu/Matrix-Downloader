#### Please feel free to fork the repository, open new issues as well as make pull requests. Thanks in advance for all your participation!

![comparison demo](http://7xrahq.com1.z0.glb.clouddn.com/matrix-output-polisher-demo-comparison.png)

# Thanks To
- [``ieb``](https://github.com/iebb/Maban) whose [Madan](https://github.com/iebb/Maban) inspired this repository.

# New
- better comparison between **standard answer output** and **your output**
- support memory check (beta)
- more options


# Main Features
Make submission output generated on Matrix more convenient to read and utilize!

- better readability
- output with line numbers
- comparison between **standard answer output** and **your output**

Supported Phases

- Compile Check
- Static Check
- Standard Tests
- Random Tests
- Memory Check (beta)

#### Options

When you are to input Problem Ids, options may be used as or appended after an id.

That means, both ``577 588c 599c`` and ``577 c 588 599`` work.

- ``c`` to get CR samples
- ``w`` to overwrite the local output file
- ``!.js!`` to set the file extension of output file to .js
- ``m`` to cancel Memory Check part

###### example

``prompt:  id: 577 588c 591 598cw 589 w 488 m 666``

- 577: default (No CR samples, No overwriting, get Memory Check)
- 588: get CR samples
- 591: default
- 598: get CR samples, overwrite local output file
- 589: default
- 488: overwrite local output file
- 666: overwrite local output file, skip Memory Check

# Demo
- compile check  
![compile check](http://7xrahq.com1.z0.glb.clouddn.com/matrix-output-polisher-demo-compilation-falied.png)

- static check  
![static check](http://7xrahq.com1.z0.glb.clouddn.com/matrix-output-polisher-demo-static-check.png)

- standard/random tests  
![tests](http://7xrahq.com1.z0.glb.clouddn.com/matrix-output-polisher-demo-comparison2.png)

- memory check  
![memory leak](http://7xrahq.com1.z0.glb.clouddn.com/matrix-output-polisher-demo-memory-leak.png)
![invalid read](http://7xrahq.com1.z0.glb.clouddn.com/matrix-output-polisher-demo-invalid-read.png)

# Precompiled Binaries

There are some precompiled binaries ( by using ``enclose`` )

[``Windows-32bit``](https://github.com/Mensu/matrix-output-polisher/releases/download/v0.3-alpha/MatrixOutputPolisher-Win32.exe)
``12.8 MB``

[``Windows-64bit``](https://github.com/Mensu/matrix-output-polisher/releases/download/v0.3.1-alpha/MatrixOutputPolisher-Win64.exe)
``16.1 MB``

[``Mac-64bit``](https://github.com/Mensu/matrix-output-polisher/releases/download/v0.3.1-alpha/MatrixOutputPolisher-Mac64)
``20.4 MB``

[``Ubuntu-64bit``](https://github.com/Mensu/matrix-output-polisher/releases/download/v0.3.1-alpha/MatrixOutputPolisher-Ubuntu64)
``22.2 MB``

You only need to execute it

# Suggestions on running

- on Windows ( suppose the downloader is located in D:\eden\ )  
 **Note: It is highly recommended that you run the executable binaries under an *ASCII-only* path on Windows.**  
\>\> Create a .bat file containing
 
~~~
cd /d "D:\eden"
MatrixOutputPolisher-Win64.exe
pause
~~~
save it as ``run.bat`` and double click to run

- on Mac ( suppose the downloader is located in /Users/$USER/Downloads/ )  
\>\> Create a .sh file containing

~~~
cd "/Users/$USER/Downloads"
./MatrixOutputPolisher-Mac64
~~~
save it as ``run.sh``, use ``sudo chmod +x ./run.sh /Users/$USER/Downloads/MatrixOutputPolisher-Mac64`` and have it run on terminal (double click to run is possible as well)  

- on Ubuntu ( suppose the downloader is located in /home/$USER/Downloads/ )  
\>\> Create a .sh file containing

~~~
gnome-terminal -x bash -c "cd "/home/$USER/Downloads"; ./MatrixOutputPolisher-Ubuntu64; printf 'Please press Enter to continue'; read"
~~~
save it as ``run.sh``, use ``sudo chmod +x ./run.sh /home/$USER/Downloads/MatrixOutputPolisher-Ubuntu64`` and have it run on terminal (double click to run is possible as well)  

# Run Source Code on node.js

[``node.js``](https://nodejs.org/en/) is required.

~~~
node op.js
~~~

## Install node.js on Windows

[``download nodejs v5.10.1 for windows``](https://nodejs.org/dist/v5.10.1/node-v5.10.1-x64.msi)

## Install node.js on Ubuntu

~~~
curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
sudo apt-get install nodejs
~~~

