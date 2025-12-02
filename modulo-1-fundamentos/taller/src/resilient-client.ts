// =================================================================
// 1. DEFINICIÓN DE INTERFACES Y TIPOS
// =================================================================

/**
 * Define la estructura de la respuesta para el perfil de un usuario.
 * El uso de interfaces es una práctica clave en TypeScript para asegurar
 * la consistencia de los datos.
 */
interface UserProfile {
  id: string;
  name: string;
  email: string;
  status?: string; // El status es opcional
}

// =================================================================
// 2. IMPLEMENTACIÓN DEL CIRCUIT BREAKER
// =================================================================

// Usamos un enum para representar los estados de forma segura.
enum CircuitState {
  CLOSED,     // El circuito está cerrado, las peticiones pasan.
  OPEN,       // El circuito está abierto, las peticiones fallan inmediatamente.
  HALF_OPEN,  // El circuito permite una petición de prueba.
}

// Configuración del Circuit Breaker
const FAILURE_THRESHOLD = 3;    // 3 fallos consecutivos para abrir el circuito.
const RESET_TIMEOUT = 5000;     // 5 segundos en estado OPEN antes de pasar a HALF_OPEN.
const REQUEST_TIMEOUT = 3000;   // Timeout de 3 segundos para cada petición fetch.

// Estado del Circuit Breaker (implementado como un objeto singleton a nivel de módulo)
let state: CircuitState = CircuitState.CLOSED;
let consecutiveFailures = 0;
let lastFailureTime = 0;

/**
 * Registra un éxito. Si el circuito estaba en HALF_OPEN, se cierra (CLOSED).
 * Reinicia el contador de fallos.
 */
function recordSuccess(): void {
  consecutiveFailures = 0;
  if (state === CircuitState.HALF_OPEN) {
    console.log('%cCircuit Breaker: RESET. El circuito ahora está CERRADO.', 'color: green');
    state = CircuitState.CLOSED;
  }
}

/**
 * Registra un fallo. Si se alcanza el umbral, el circuito se abre (OPEN).
 */
function recordFailure(): void {
  consecutiveFailures++;
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    state = CircuitState.OPEN;
    lastFailureTime = Date.now();
    console.error(`%cCircuit Breaker: UMBRAL ALCANZADO. El circuito ahora está ABIERTO por ${RESET_TIMEOUT / 1000}s.`, 'color: red');
  }
}

/**
 * Lógica principal que decide si una petición puede proceder.
 * Implementa la máquina de estados.
 */
function canAttemptRequest(): boolean {
  switch (state) {
    case CircuitState.CLOSED:
      return true;
    case CircuitState.OPEN:
      // Si ha pasado el tiempo de reset, pasamos a HALF_OPEN para un intento.
      if (Date.now() - lastFailureTime > RESET_TIMEOUT) {
        console.log('%cCircuit Breaker: Timeout finalizado. Pasando a estado HALF_OPEN.', 'color: orange');
        state = CircuitState.HALF_OPEN;
        return true;
      }
      // Aún no ha pasado el tiempo, la petición falla rápido.
      return false;
    case CircuitState.HALF_OPEN:
      // Solo se permite un intento mientras está en HALF_OPEN.
      // La lógica de `fetchWithCircuitBreaker` se encargará de cambiar el estado
      // a OPEN o CLOSED después de este intento.
      return true;
  }
}

// =================================================================
// 3. WRAPPER DE FETCH CON CIRCUIT BREAKER Y TIMEOUTS
// =================================================================

/**
 * Un wrapper sobre el fetch nativo que integra la lógica del Circuit Breaker
 * y un timeout para las peticiones.
 * @param url La URL del recurso a solicitar.
 * @param options Opciones de Fetch, como method, headers, body.
 * @returns Una promesa que resuelve con la respuesta si es exitosa.
 */
async function fetchWithCircuitBreaker(url: string, options: RequestInit = {}): Promise<Response> {
  if (!canAttemptRequest()) {
    // Falla rápido si el circuito está abierto.
    return Promise.reject(new Error("Circuit Breaker is open. Request blocked."));
  }

  // Implementación del timeout usando AbortController (práctica estándar con fetch)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  options.signal = controller.signal;

  try {
    const response = await fetch(url, options);
    clearTimeout(timeoutId); // Limpiar el timeout si la respuesta llega a tiempo

    if (!response.ok) {
      // Errores HTTP (ej. 404, 500) también cuentan como fallos.
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    recordSuccess(); // La petición fue exitosa
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    recordFailure(); // La petición falló (timeout, error de red, http no-ok)
    // Re-lanzamos el error para que el código que llama pueda manejarlo.
    throw error;
  }
}

// =================================================================
// 4. LÓGICA DE APLICACIÓN REFACTORIZADA Y SEGURA
// =================================================================

const API_BASE_URL = 'https://api.example.com'; // Usar HTTPS siempre

/**
 * Obtiene el perfil de un usuario de forma segura y resiliente.
 * @param userId ID del usuario a obtener.
 * @param apiKey La clave de API, pasada como argumento para no estar hardcodeada.
 * @returns El perfil del usuario.
 */
async function getUserProfile(userId: string, apiKey: string): Promise<UserProfile> {
  const url = `${API_BASE_URL}/users/${userId}`;
  const options: RequestInit = {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  };
  const response = await fetchWithCircuitBreaker(url, options);
  return await response.json() as UserProfile;
}

/**
 * Actualiza el estado de un usuario de forma segura.
 * @param userId ID del usuario a actualizar.
 * @param status Nuevo estado.
 * @param apiKey La clave de API.
 * @returns La respuesta del servidor.
 */
async function updateUserStatus(userId: string, status: string, apiKey: string): Promise<any> {
    const url = `${API_BASE_URL}/users/${userId}/status`;
    const options: RequestInit = {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
    };
    const response = await fetchWithCircuitBreaker(url, options);
    return await response.json();
}

/**
 * Muestra el perfil del usuario en el DOM de forma segura para prevenir XSS.
 * En lugar de usar innerHTML, asignamos el contenido a través de textContent.
 * @param user El objeto UserProfile.
 */
function displayUserProfileSecurely(user: UserProfile): void {
  const userProfileDiv = document.getElementById('user-profile');
  if (userProfileDiv) {
    // Limpiar contenido previo
    userProfileDiv.innerHTML = '';

    const header = document.createElement('h2');
    header.textContent = user.name; // SEGURO: textContent no interpreta HTML.

    const emailPara = document.createElement('p');
    emailPara.textContent = `Email: ${user.email}`; // SEGURO

    userProfileDiv.appendChild(header);
    userProfileDiv.appendChild(emailPara);
  }
}
