var http = require("http"),
    fs = require("fs");

var OUTPUT_MESSAGE = "Hello World!\n",
    OUTPUT_FILE_NAME = "hello.txt",
    COUNT_FILE_NAME = "startCount.txt",
    FILE_NOT_FOUND_ERR_CODE = "ENOENT";

var startCount = 0;

exports.start = function (){
    http.createServer(function(request, response){
        fs.readFile(OUTPUT_FILE_NAME, function(err, data){ // async call
            if((err && err.code === "ENOENT") || data.length === 0)
                return resetStartCountAndAppendToFile(response);

            incrementStartCountAndAppendToFile(response);
        });
    }).listen(3000);

    console.log("Server started");
}

function incrementAppStartCount(){
    fs.readFile(COUNT_FILE_NAME, 'utf8', function(err, count){ //'utf8' or you'll get a "BUFFER"
        if(err) startCount = 0;

        startCount = count;
        fs.writeFile(COUNT_FILE_NAME, ++startCount);
    });
}

function resetStartCountAndAppendToFile(response){
    startCount = 1;
    fs.writeFile(COUNT_FILE_NAME, startCount, function(){ // async call
        appendToFile(OUTPUT_FILE_NAME, OUTPUT_MESSAGE, response);
    });
}

function incrementStartCountAndAppendToFile(response){
    incrementAppStartCount();
    appendToFile(OUTPUT_FILE_NAME, OUTPUT_MESSAGE, response);
}

function appendToFile(fileName, message, response){
    fs.appendFile(fileName, message, function(err, result){
        if(err) return handleError(err);
        response.writeHead(200, {"Content-Type": "text/plain"});
        response.write("Wrote to file: " + OUTPUT_FILE_NAME + "\n");
        response.end();
        console.log("App has been started " + startCount + " times");
    });
}
