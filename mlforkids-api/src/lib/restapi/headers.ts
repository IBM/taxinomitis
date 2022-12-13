export const NO_CACHE = {
    'Cache-Control' : 'no-store, no-cache, must-revalidate',
    'Expires' : 0,
};

export const CACHE_10SECONDS = {
    'Cache-Control' : 'max-age=10',
};

export const CACHE_1MINUTE = {
    'Cache-Control' : 'max-age=60',
};

export const CACHE_2MINUTES = {
    'Cache-Control' : 'max-age=120',
};

export const CACHE_6MINUTES = {
    'Cache-Control' : 'max-age=360',
};

export const CACHE_1HOUR = {
    'Cache-Control' : 'max-age=3600',
};

export const CACHE_1YEAR = {
    'Cache-Control' : 'max-age=31536000',
};
