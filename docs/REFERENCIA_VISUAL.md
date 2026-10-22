# Referencia visual de IngenIA Studio

Referencia principal: [Mapa de experiencia con IA universitaria.png](<../Mapa de experiencia con IA universitaria.png>), archivo original conservado en la raíz. Revisión inicial: 21 de octubre de 2026.

La imagen se inspeccionó y se comparó con las plantillas HTML de las tres vistas, `packages/ui/app.mjs` y `packages/ui/style.css`. Esta revisión es de referencia y código: no se hizo todavía una comparación de capturas renderizadas en navegador.

## Activo oficial recibido

[IMAGOTIPO_HORIZONTAL_BLANCO.png](../IMAGOTIPO_HORIZONTAL_BLANCO.png), 1839 × 570 px. Se conserva el original y una copia idéntica en `packages/ui/assets/`. Las tres vistas lo utilizan sobre fondo verde oscuro, con altura automática, texto alternativo y separación respecto de la marca IngenIA. No se aplican recortes, recoloreados ni filtros. Pendiente validar legibilidad y área de protección con capturas y manual institucional.

## Dirección visual

La referencia combina un marco institucional verde profundo con contenido claro y acentos lima brillantes. Los teléfonos muestran encabezados y navegación oscuros, formularios y resultados claros y acciones muy visibles. La consola usa una estructura de escritorio más densa; el auditorio amplía la fase y el reloj. Las tres superficies deben compartir marca, tipografía, iconos, componentes y significado de estados.

El campus desenfocado, las tramas geométricas y los puntos son recursos ambientales de la lámina; no es necesario reproducirlos detrás de cada formulario. Su uso requiere activos adecuados y no debe reducir la legibilidad. Los marcos de teléfonos y el portátil son soportes de presentación, no elementos de la interfaz de producción.

## Paleta propuesta para implementación

Estos colores son aproximaciones visuales de la imagen, no una extracción certificada ni valores oficiales de la Universidad. Validar con el manual institucional y verificar contraste en cada combinación antes de aprobarlos.

| Token propuesto | Valor inicial | Aplicación |
|---|---|---|
| `--color-bg` | `#002B1B` | Fondo principal verde profundo |
| `--color-bg-deep` | `#001A13` | Navegación, código y zonas de mayor contraste |
| `--color-brand` | `#006B3C` | Superficies y acciones institucionales |
| `--color-accent` | `#C6F500` | CTA principal y fase activa |
| `--color-surface` | `#F5FAF7` | Formularios y tarjetas claras |
| `--color-text-dark` | `#082D22` | Texto sobre superficies claras |
| `--color-text-light` | `#FFFFFF` | Texto sobre superficies oscuras |
| `--color-border` | `#2E6C52` | Bordes y separadores oscuros |
| `--color-success` | `#078B4D` | Actividad completada o mitigación del fixture |
| `--color-warning` | `#F0AB36` | Advertencias y riesgos medios |
| `--color-danger` | `#C83F48` | Riesgos altos y errores |

No usar texto blanco sobre lima. Separar el lima de acción del verde de completado y añadir etiquetas: «Activa», «Completada», «Bloqueada», «Solo lectura».

## Diferencias con la base actual

| Área | Estado inicial observado | Cambio necesario |
|---|---|---|
| Marca | Imagotipo oficial incorporado en las tres vistas junto a IngenIA Studio | Validar composición, legibilidad y área de protección en navegador |
| Color | Fondo `#071c19`, panel `#10332b`, acento `#d1fa75` | Afinar verdes y lima más intenso; añadir superficies claras |
| Tarjetas y campos | Predominio de paneles y campos oscuros | Introducir variantes claras para formularios y resultados |
| Tipografía | `system-ui`, escala básica | Definir jerarquía común y revisar tipografía institucional disponible |
| Iconografía | Sin sistema de iconos | Elegir una familia coherente para navegación, fases y estados |
| Participante | Página vertical compartida | Dar composición móvil a ingreso, actividad y resultados; diseñar navegación inferior |
| Conferencista | Botones y resumen en una tarjeta | Separar navegación lateral, controles, reloj y paneles operativos |
| Proyector | Mismo layout con títulos y reloj mayores | Componer pantalla 16:9 específica con lectura a distancia |
| Estados | Fase activa con borde; mensajes básicos | Unificar estados visuales con etiqueta, icono, color y foco accesible |
| Evidencia visual | Sin capturas comparativas | Registrar revisión de las tres superficies en resoluciones objetivo |

## Mapa de pantallas frente a las cinco fases

| Pantalla de referencia | Ubicación funcional |
|---|---|
| Registro | Acceso a sesión, antes de actividad; datos mínimos/seudónimo |
| Evento y horarios | Selección de sala; dos grupos independientes |
| Inicio / Actividades | Inicio con espera, misión y estado global |
| Generador IA | Separar editor de idea/prompt en fase 1 y generación DEMO en fase 2 |
| Vista previa app | Fase 2; lectura posterior según permisos |
| Código generado | Fase 2; historial en lectura en fases siguientes |
| Auditoría / Red Team | Fase 3, escenario educativo |
| Corrección / Blue Team | Fase 4, mitigaciones educativas |
| Resultado final | Fase 5, checklist y decisión GO/NO GO para demo |
| Perfil y certificado | Complementaria; certificado solo con reglas institucionales y asistencia verificada |

La implementación sigue ahora las seis fases de INGGEN AI-DSE (ver `TODO_INGENIA_AI_DSE.md`); el mapa anterior de cinco fases queda como referencia histórica. No mostrar «Lista para producción» ni «asistencia confirmada» con información simulada. Cualquier ranking requiere configuración, criterios transparentes y datos públicos o anonimizados.

## Condición de aprobación

La alineación sigue pendiente. Revisar capturas de participante en 360/390 px, Control Center en 1440 px y auditorio en 1920×1080, incluyendo espera, fase activa, completado, bloqueo, pausa, reconexión y errores. Verificar formularios, foco, contraste y lectura a distancia. El logo debe proceder del activo oficial; el presente mapa no lo sustituye.


## Primera iteración: ingreso de participantes

Se aplicó la referencia específica de «Únete al taller» recibida por el usuario: encabezado institucional compacto, fondo verde, tarjeta clara con campos e iconos, selector de horario y CTA lima. Se conservan seudónimo del equipo y código de sala en lugar de incorporar nombre/correo personal. La confirmación informa que es una simulación educativa; no sustituye términos institucionales todavía pendientes de definición.

Estilos aislados en `packages/ui/participant.css`; Studio y proyector conservan su presentación. El estado de conexión se muestra durante las actividades, sin ocupar el encabezado del ingreso. Al volver al formulario se cierra el stream anterior para evitar avisos de reconexión obsoletos.

Verificación en Chrome con viewport emulado de 360×800, 393×852 y 1440×1000: sin desbordamiento horizontal; formulario, CTA y pie visibles en ambas vistas móviles. El backend comprueba la coincidencia de horario y código de sala.

[Captura del ingreso a 393 px](capturas/participante-ingreso-393.png). Pendiente recibir las siguientes referencias y validación del usuario.
