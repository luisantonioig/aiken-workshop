
# Proyecto Nombre

Este proyecto requiere configurar algunas dependencias antes de ejecutarse. Sigue los pasos a continuación para poner todo en marcha.

## Requisitos

**Blockfrost API Key**: Necesitarás una clave API de Blockfrost. Puedes obtenerla creando una cuenta en [Blockfrost.io](https://blockfrost.io/).

## Pasos para la configuración

1. **Clonar el repositorio**:
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd <NOMBRE_DEL_DIRECTORIO>
   ```

2. **Configurar el archivo `.env.local`**:
   Crea un archivo `.env.local` en la raíz del proyecto y añade la siguiente variable:

   ```env
   BLOCKFROST_API_KEY=TU_API_KEY_DE_BLOCKFROST
   ```

   Asegúrate de reemplazar `TU_API_KEY_DE_BLOCKFROST` con la clave real que obtuviste de Blockfrost.

3. **Instalar dependencias**:
   Ejecuta el siguiente comando para instalar todas las dependencias necesarias:
   ```bash
   npm install
   ```

4. **Iniciar el servidor**:
   Una vez que las dependencias estén instaladas, inicia el servidor de desarrollo con:
   ```bash
   npm run dev
   ```

## Uso

Después de iniciar el servidor, accede al proyecto desde tu navegador en la URL que se muestra en la terminal, generalmente `http://localhost:3000`.
