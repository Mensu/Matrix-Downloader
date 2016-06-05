#### Please feel free to fork the repository, open new issues as well as make pull requests. Thanks in advance for all your participation!


# Main Features
Make submission output generated on Matrix more convenient to read and utilize!

- better readability
- output with line numbers
- simple comparison between standard answer output and your output

Supported Phase:

- Compile Check
- Static Check
- Standard Tests
- Random Tests

Memory Check is not supported for the moment.

# Precompiled Binaries

There are some precompiled binaries ( by using ``enclose`` )

[``Windows-32bit``](https://github.com/Mensu/matrix-output-polisher/releases/download/v0.2-alpha/MatrixOutputPolisher-Win32.exe)
``12.6 MB``

[``Windows-64bit``](https://github.com/Mensu/matrix-output-polisher/releases/download/v0.2-alpha/MatrixOutputPolisher-Win64.exe)
``15.9 MB``

[``Mac-64bit``](https://github.com/Mensu/matrix-output-polisher/releases/download/v0.2-alpha/MatrixOutputPolisher-Mac64)
``29.5 MB``

[``Ubuntu-64bit``](https://github.com/Mensu/matrix-output-polisher/releases/download/v0.2-alpha/MatrixOutputPolisher-Ubuntu64)
``22.0 MB``

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

