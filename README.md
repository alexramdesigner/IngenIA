# IngenIA Studio

Base ejecutable del taller «Crea tu primera APP con IA». Dos salas independientes para el **18 de noviembre de 2026, 14:00–16:00 y 18:00–20:00, America/Bogota**.

Implementa las fundaciones de M0 y un recorrido mínimo DEMO de las cinco fases. **No está aprobado todavía para operar el evento.** Ver [estado y pendientes](docs/ESTADO.md).

## Arranque local

Requisito: Node.js 24. No necesita instalación de paquetes externos, IA, Docker ni conexión a Internet para funcionar.

```sh
npm run setup
npm run dev
```

`setup` crea `.env` con una contraseña aleatoria; si ya existe, lo conserva. Consulta `PRESENTER_PASSWORD` en ese archivo desde tu editor. Nunca copies `.env` al repositorio.

- Participantes: http://127.0.0.1:3000/
- Conferencista: http://127.0.0.1:3000/studio
- Proyector: http://127.0.0.1:3000/projector
- Salud del servicio/base de datos: http://127.0.0.1:3000/healthz

Herd puede seguir administrando tus otros proyectos. Esta aplicación utiliza su propio proceso Node; abrir el directorio como sitio PHP de Herd no inicia la API.

## Probar el taller

1. Abre Control Center, elige grupo e ingresa con la contraseña local. Cada sesión comienza en `WAITING`.
2. Abre la vista del participante, selecciona el horario e ingresa un nombre de equipo; para probar como estudiante sin privilegios utiliza otro navegador o perfil. Cada integrante ingresa desde su propio navegador; **máximo seis por equipo**. Tras seleccionar el horario, escribe el nombre y selecciona el equipo sugerido. Si no existe, se crea al ingresar; mayúsculas y espacios equivalentes no crean equipos distintos.
3. En Studio, pulsa **Abrir proyección 16:9**. Se abre una pestaña independiente de solo lectura en el mismo navegador, sin reemplazar el acceso del conferencista. Permite ventanas emergentes si el navegador las bloquea. Mueve esa pestaña a la pantalla del auditorio y pulsa **Pantalla completa** (el control aparece al mover el puntero o enfocarlo con Tab). El lienzo 1920×1080 se escala automáticamente y conserva 16:9 con bandas negras cuando corresponde.
4. Inicia Ideación, guarda una idea y avanza desde Control Center. Genera, justifica hallazgos, aplica correcciones y registra GO / NO GO. El proyector muestra estado y progreso real de equipos; los artefactos están rotulados DEMO.
5. Comprueba pausa, reanudación y reapertura. Para cambiar de grupo cierra el acceso e ingresa de nuevo. Al finalizar, las lecturas permanecen disponibles durante la vigencia del acceso.

Los prompts se guardan al pulsar **Guardar idea lista**. Lo escrito sin guardar permanece solo en memoria de la pestaña. No se usa localStorage como autoridad ni se promete autosave todavía.

Los estudiantes no ven enlaces a Studio o proyección. Sus accesos son rechazados por el servidor en esas páginas y APIs. Los participantes ingresan por horario, sin código manual. El servidor conserva un identificador estadístico por fecha y sesión (`ING-20261118-1400-TARDE` o `ING-20261118-1800-NOCHE`), visible en Studio y en reportes.

El acceso al login de Studio sin autenticar es público, pero solo la contraseña del conferencista habilita la consola. Cada vista usa una cookie de rol independiente. `/presenter` permanece como alias de `/studio`.

## Verificación

```sh
npm run check
npm test
```

Las pruebas abren puertos temporales en loopback. Incluyen API HTTP, SSE, transacciones, reloj y persistencia SQLite. No sustituyen pruebas con móviles, E2E de navegador ni carga real. El caso de jobs tardíos se prueba rechazando una entrega con fase/versión obsoletas; aún no existe un worker de IA.

## Estructura

```text
apps/participant/  Pantalla de ingreso y estudio
apps/presenter/    Control Center
apps/projector/    Auditorio, solo lectura
services/api/      HTTP, autenticación, SQLite y motor de fases
packages/shared/  Catálogo de fases y contratos TypeScript
packages/ui/      Interfaz compartida y tokens de diseño
scripts/          Configuración, validación y respaldo
tests/            Aceptación y seguridad
docs/             Arquitectura, operación y estado
```

## Ejecución y despliegue

```sh
npm start
npm run backup
```

La base persistente se crea en `data/ingenia.sqlite`. El respaldo usa `VACUUM INTO` para producir una copia consistente incluso con WAL, en `data/backups/`. Los respaldos contienen trabajo de equipos y deben protegerse.

También se proporciona `Dockerfile` y `compose.yaml` para **una instancia**:

```sh
docker compose up --build -d
docker compose logs -f ingenia
```

Docker no estaba instalado en el entorno de implementación; esta ruta requiere validación. El volumen `ingenia-data` conserva la base. No ejecutes `docker compose down -v` si necesitas conservar datos.

Para acceso remoto, usa HTTPS mediante un proxy y establece `COOKIE_SECURE=true`. El proxy debe conservar `Host`, desactivar buffering de `/api/sessions/*/events` y permitir SSE persistente. La configuración predeterminada escucha solo en localhost. Consulta [operación](docs/OPERACION.md) antes de exponer el servicio.

## Iconos

Se utiliza [Phosphor Icons](https://github.com/phosphor-icons/core) (MIT). La selección de SVG está incluida localmente: la app funciona sin CDN ni descarga de fuentes. Para actualizar la selección, instalar dependencias de desarrollo con `npm ci`, editar `scripts/icons.mjs` y ejecutar `npm run icons`. El generador actualiza el módulo y los iconos estáticos de las plantillas; conservar la licencia en `packages/ui/licenses/`.

## Presentación del evento

La presentación se maneja manualmente fuera de IngenIA. Studio conserva los controles del taller y el proyector muestra su estado.

## Explicación y práctica

En Studio prepara **Notas para la explicación** seleccionando cada fase y pulsando **Guardar notas**. Son privadas y se guardan por horario. Inicia la explicación de la fase; cuando termines tu presentación manual, pulsa **Habilitar práctica** para abrir la actividad a los equipos e iniciar el cronómetro. Avanzar o reabrir una fase comienza nuevamente por explicación. Guarda tus borradores antes de recargar o cerrar Studio.

## Dar la palabra y revisar un equipo

Después de que un equipo guarde su entrega, en Studio busca **Dar la palabra a un equipo** y pulsa **Dar la palabra y proyectar**. El auditorio verá su nombre, número de integrantes y trabajo de la fase actual. Puedes cambiar de equipo, actualizar la entrega proyectada o pulsar **Volver al taller**. Los trabajos largos se recorren con Anterior/Siguiente desde Studio. La revisión usa una copia de la entrega guardada y no altera el cronómetro; cambiar de fase la cierra automáticamente.
