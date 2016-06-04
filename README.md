#### Please feel free to fork the repository, open new issues as well as make pull requests. Thanks in advance for all your participation!


# Main Features
Make submission output generated on Matrix more convenient to read and utilize!

Note: Only txt files encoded in utf-8 are accepted.  
WARNING: The original file will be OVERWRITTEN. It is wise to backup in advance.

We would appreciate it if you find a **filename that cannot be properly recognized** by the program and are willing to report to us [by email](mailto:yxshw55@qq.com) or [by opening an issue](https://github.com/Mensu/Matrix-Output-Polisher/issues/new)!

# Tutorial

1. Right-click on the json output and select "检查" on Chrome.  
<center>![right click on nearly unreadable output](http://7xrahq.com1.z0.glb.clouddn.com/matrix-output-polisher-tutorial-right-click.png)</center>
2. Click to unfold and copy the json test.  
<center>![unfold](http://7xrahq.com1.z0.glb.clouddn.com/matrix-output-polisher-tutorial-unfold.png)</center>
<center>![copy-1](http://7xrahq.com1.z0.glb.clouddn.com/matrix-output-polisher-tutorial-copy1.png)</center>
<center>![copy-2](http://7xrahq.com1.z0.glb.clouddn.com/matrix-output-polisher-tutorial-copy2.png)</center>
3. Save the test in "output.txt" encoded in **UTF-8** before moving the output.txt to the folder where the MatrixOutputPolisher is located.  
<center>![save](http://7xrahq.com1.z0.glb.clouddn.com/matrix-output-polisher-tutorial-save.png)</center>
4. Run the polisher through run.bat/ run.sh (see suggestions on running below) and simply press Enter to obtain a nicer output!  
<center>![run](http://7xrahq.com1.z0.glb.clouddn.com/matrix-output-polisher-tutorial-run.png)</center>
<center>![result](http://7xrahq.com1.z0.glb.clouddn.com/matrix-output-polisher-tutorial-result.png)</center>


# Precompiled Binaries

There are some precompiled binaries ( by using ``enclose`` )

[``Windows-32bit``](https://github.com/Mensu/matrix-output-polisher/releases/download/v0.1-alpha/MatrixOutputPolisher-Win32.exe)
``9.3 MB``

[``Windows-64bit``](https://github.com/Mensu/matrix-output-polisher/releases/download/v0.1-alpha/MatrixOutputPolisher-Win64.exe)
``11.8 MB``

[``Mac-64bit``](https://github.com/Mensu/matrix-output-polisher/releases/download/v0.1-alpha/MatrixOutputPolisher-Mac64)
``16.0 MB``

[``Ubuntu-64bit``](https://github.com/Mensu/matrix-output-polisher/releases/download/v0.1-alpha/MatrixOutputPolisher-Ubuntu64)
``17.8 MB``

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

