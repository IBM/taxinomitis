(function () {

    angular
        .module('app')
        .service('weatherService', weatherService);

    weatherService.$inject = [ '$http' ];


    function weatherService($http) {

        function getCurrentWeather(latitude, longitude) {
            return $http.get('https://api.open-meteo.com/v1/forecast', {
                    params : {
                        latitude : latitude,
                        longitude : longitude,
                        current_weather : true
                    }
                })
                .then((resp) => {
                    const weather = resp.data && resp.data.current_weather;
                    if (!weather) {
                        throw new Error('weather information is not available for this location');
                    }

                    return {
                        temperature : weather.temperature,
                        windspeed : weather.windspeed,
                        winddirection : weather.winddirection,
                        weathercode : weather.weathercode,
                        description : getWeatherCodeDescription(weather.weathercode)
                    };
                }, () => {
                    throw new Error('unable to retrieve the weather');
                });
        }

        function getWeatherCodeDescription(weathercode) {
            switch (weathercode) {
                case 0:
                    return 'clear sky';
                case 1:
                    return 'mainly clear';
                case 2:
                    return 'partly cloudy';
                case 3:
                    return 'overcast';
                case 45:
                    return 'fog';
                case 48:
                    return 'depositing rime fog';
                case 51:
                    return 'light drizzle';
                case 53:
                    return 'moderate drizzle';
                case 55:
                    return 'dense drizzle';
                case 56:
                    return 'light freezing drizzle';
                case 57:
                    return 'dense freezing drizzle';
                case 61:
                    return 'slight rain';
                case 63:
                    return 'moderate rain';
                case 65:
                    return 'heavy rain';
                case 66:
                    return 'light freezing rain';
                case 67:
                    return 'heavy freezing rain';
                case 71:
                    return 'slight snow';
                case 73:
                    return 'moderate snow';
                case 75:
                    return 'heavy snow';
                case 77:
                    return 'snow grains';
                case 80:
                    return 'slight rain showers';
                case 81:
                    return 'moderate rain showers';
                case 82:
                    return 'violent rain showers';
                case 85:
                    return 'slight snow showers';
                case 86:
                    return 'heavy snow showers';
                case 95:
                    return 'thunderstorm';
                case 96:
                    return 'thunderstorm with slight hail';
                case 99:
                    return 'thunderstorm with heavy hail';
                default:
                    return 'unknown';
            }
        }


        return {
            getCurrentWeather
        };
    }
})();
