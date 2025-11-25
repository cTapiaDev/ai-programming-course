// ☠️ CÓDIGO LEGADO PELIGROSO ☠️
const https = require('https');

function getUserData(userId) {
    return new Promise((resolve, reject) => {
        // FALLO 1: Sin Timeouts. Si la API cuelga, nosotros colgamos.
        // FALLO 2: Callback Hell mezclado con Promesas.
        // FALLO 3: Sin Tipos.
        const req = https.get(`https://api-externa.com/users/${userId}`, (res) => {
            let data = '';
            
            // FALLO 4: Si el JSON viene roto, el JSON.parse explota sin catch.
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(JSON.parse(data))); 
            
        });

        req.on('error', (e) => {
            console.log("Error en la petición"); // Log inútil
            resolve(null); // FALLO 5: Silencia el error devolviendo null
        });
    });
}

module.exports = { getUserData };