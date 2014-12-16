var http = require("http"),
    fs = require("fs"),
    sys = require("sys"),
    superagent = require("superagent");

var OUTPUT_MESSAGE = "Server started!\n",
    OUTPUT_FILE_NAME = "serverlog.txt",
    WEATHER_FILE_NAME = "weather.txt",
    COUNT_FILE_NAME = "startCount.txt",
    FILE_NOT_FOUND_ERR_CODE = "ENOENT",
    GMAP_API_KEY = "AIzaSyDpcTnctfSqxyd7c31D_EfIFP_OSUfwQTY",
    FORECAST_IO_API_KEY = "51de5145c6b2729831f4ac2349052750";

var startCount = 0;

exports.start = function (){
    http.createServer(function(request, response){
        fs.readFile(OUTPUT_FILE_NAME, function(err, data){ // async call
            if((err && err.code === "ENOENT") || data.length === 0)
                return resetStartCountAndAppendToFile(response);

            incrementStartCountAndAppendToFile(response);
        });
    }).listen(3000);

    process.stdout.write("Server started\n");
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
    fs.appendFile(fileName, message, {"encoding":"utf8"}, function(err, result){
        if(err) console.log(err);

        response.writeHead(200, {"Content-Type": "text/plain"});
        response.write("Wrote to log file: " + fileName + "\n");
        response.end();
        process.stdout.write("App has been started " + startCount + " times\n");
        askForAddressAndGetCoordinates();
    });
}

function askForAddressAndGetCoordinates(){
    process.stdout.write("Please enter your address.\n");
    process.stdout.write("> ");
    doWithStdIn(function(address){
        address = address.trim();
        process.stdout.write("you entered " + address + "\n");
        return resolveAddressCoordinates(address);
    });
}

function doWithStdIn(fn){
    var stdin = process.openStdin();
    stdin.setEncoding('utf8');
    stdin.once("data", fn);
}

function resolveAddressCoordinates(address){
    var agent = superagent.agent();
    var GMAP_API_URL = "https://maps.googleapis.com/maps/api/geocode/json?address=" + address + "&key=" + GMAP_API_KEY;
    agent.get(GMAP_API_URL)
         .end(function(err, result){

             if(err || result.status !== 200){
                 process.stdout.write("Sorry, something went wrong. Please try again.\n");
                 return process.nextTick(askForAddressAndGetCoordinates);
             }

             var mapResult = JSON.parse(result.text);

             if(mapResult.status !== "OK"){
                if(mapResult.status === "ZERO_RESULTS"){
                    process.stdout.write("Sorry, we weren't able to find any coordinates for the address you entered. Please enter another address.\n");
                    return process.nextTick(askForAddressAndGetCoordinates);
                }
                if(mapResult.status === "UNKNOWN_ERROR"){
                    process.stdout.write("Sorry, something went wrong. Please try again.\n");
                    return process.nextTick(askForAddressAndGetCoordinates);
                }
                else return;
             }

             if(mapResult.results.length > 1){
                process.stdout.write("We think you might be in one of the following locations. Please select your location by pressing the associated number:\n");

                mapResult.results.forEach(function(potentialLocation, idx){
                    process.stdout.write("Press " + (idx + 1) + " for: " + potentialLocation.formatted_address + "\n");
                });
                process.stdout.write("Press n to enter a new address.\n");

                doWithStdIn(processEnteredIndex(mapResult.results));
             }
             else
                getWeatherForecast(address, mapResult.results[0].geometry.location);

         });
}

function processEnteredIndex(arr){
    return function(idxSelected){
        idxSelected = idxSelected.trim();

        if(idxSelected === 'n')
            return process.nextTick(askForAddressAndGetCoordinates);

        if(isNaN(parseInt(idxSelected) || idxSelected < 1 || idxSelected > arr.length)){
            process.stdout.write("Please enter a valid choice.\n");
            return process.nextTick(function(){doWithStdIn(processEnteredIndex(arr))}); //nextTick needs a callback!
        }

        var selectedAddress = arr[idxSelected-1];
        getWeatherForecast(selectedAddress.formatted_address, selectedAddress.geometry.location);
    };
};

function getWeatherForecast(physicalAddress, coords){
    var FORECAST_IO_API_URL = "https://api.forecast.io/forecast/" + FORECAST_IO_API_KEY + "/" + coords.lat + "," + coords.lng + "?units=uk";
    var agent = superagent.agent();
    var startTime = process.hrtime();
    agent.get(FORECAST_IO_API_URL)
         .end(function(err, result){
            if(err || result.status !== 200){
                process.stdout.write("Sorry, something went wrong getting your weather. Please try again.\n");
                return process.nextTick(askForAddressAndGetCoordinates);
            }

            var forecastResult = JSON.parse(result.text);
            var timeTakenForRequest = process.hrtime(startTime);
            process.stdout.write("The weather at your location is: " + forecastResult.currently.summary + "\n");
            fs.appendFile(WEATHER_FILE_NAME, createWeatherLogMessage(physicalAddress, forecastResult, timeTakenForRequest), {"encoding":"utf8"}, function(err, result){
                if(err) console.log(err);
                process.stdout.write("Thank you for using the app.\n");
                process.exit();
            });
        });
}

function createWeatherLogMessage(physicalAddress, forecastResult, timeTakenForRequest){
    return "Details of weather request made:" + "\n" +
           "Time: " + new Date().toString() + "\n" +
           "Address: " + physicalAddress + "\n" +
           "GPS lat: " + forecastResult.latitude + "\n" +
           "GPS long: " + forecastResult.longitude + "\n" +
           "Weather summary: " + forecastResult.currently.summary + "\n" +
           "Time taken for request: " + timeTakenForRequest[0] + " seconds and " + (timeTakenForRequest[1]/1000000).toFixed(2) + " milliseconds\n" +
           "-------------------\n";
}
