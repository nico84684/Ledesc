
import { Metadata } from 'next';
import { APP_NAME } from '@/config/constants';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { HelpCircle, TrendingUp, ShoppingCart, History, Store, Settings, FileUp, FileDown, BellRing, Search, UserCheck, MailQuestion, MessageSquare, Send, Smartphone, Share, MoreVertical, PlusSquare, Cloud, Lock } from 'lucide-react';

export const metadata: Metadata = {
  title: `Centro de Ayuda - ${APP_NAME}`,
  description: 'Encuentra respuestas y guías sobre cómo usar la aplicación LEDESC.',
};

export default function HelpPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <header className="text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground flex items-center justify-center gap-3">
          <HelpCircle className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
          Centro de Ayuda
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Encuentra respuestas a tus preguntas sobre el uso de {APP_NAME}.
        </p>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Guía de Funcionalidades</CardTitle>
          <CardDescription>Haz clic en cada sección para expandir y ver los detalles.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg hover:no-underline">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Dashboard (Inicio)
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-base pl-2">
                <p><strong>¿Qué es el Dashboard?</strong></p>
                <p>El Dashboard es tu pantalla principal. Te ofrece un resumen rápido de tu beneficio gastronómico y accesos directos a las funciones más importantes.</p>
                
                <p><strong>Resumen del Beneficio Mensual:</strong></p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>Muestra cuánto has gastado en el mes actual, tu saldo restante y el beneficio total configurado.</li>
                  <li>Visualiza el porcentaje de tu beneficio que ya has utilizado.</li>
                  <li>Te informa cuántos días quedan en el mes actual.</li>
                </ul>

                <p><strong>Accesos Rápidos:</strong></p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li><strong>Nueva Compra:</strong> Te lleva directamente a registrar un nuevo gasto.</li>
                  <li><strong>Historial:</strong> Accede a la lista de todas tus compras pasadas.</li>
                  <li><strong>Configuración:</strong> Ajusta los parámetros de tu beneficio y gestiona tus datos.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg hover:no-underline">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  Registrar Nueva Compra
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-base pl-2">
                <p><strong>¿Cómo registro una nueva compra?</strong></p>
                <p>Desde el Dashboard o el menú lateral, accede a "Registrar Compra". Completa el formulario con los detalles de tu gasto.</p>
                
                <p><strong>Datos del Formulario:</strong></p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li><strong>Monto Total ($):</strong> El costo total de la compra antes del descuento (obligatorio).</li>
                  <li><strong>Fecha de Compra:</strong> La fecha en que realizaste la compra (obligatorio, por defecto hoy).</li>
                  <li><strong>Nombre del Comercio:</strong> El nombre del lugar donde compraste (obligatorio). Puedes escribir uno nuevo o seleccionar de tu lista de comercios guardados.</li>
                  <li><strong>Ubicación del Comercio:</strong> La dirección o sucursal (opcional, pero útil para distinguir comercios con el mismo nombre). Se autocompleta si seleccionas un comercio existente con ubicación.</li>
                  <li><strong>Descripción:</strong> Notas adicionales sobre la compra (opcional).</li>
                </ul>
                 <p>Al registrar, el sistema calculará automáticamente el descuento (según tu configuración) y el monto final. Si has iniciado sesión, la compra se guardará automáticamente en tu Google Drive.</p>
                 <p>Los comercios nuevos (combinación de nombre y ubicación) se añaden automáticamente a tu lista en la sección "Comercios".</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger className="text-lg hover:no-underline">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Historial de Transacciones
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-base pl-2">
                <p><strong>¿Qué puedo ver en el Historial?</strong></p>
                <p>Aquí encontrarás una tabla con todas tus compras registradas, ordenadas por fecha (la más reciente primero).</p>
                
                <p><strong>Información por Compra:</strong></p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>Fecha, Nombre del Comercio, Descripción.</li>
                  <li>Monto Original, Descuento Aplicado y Monto Final.</li>
                  <li>Acceso a ver el recibo (si fue cargado, funcionalidad futura).</li>
                </ul>

                <p><strong>Filtrar Transacciones:</strong></p>
                <p>Usa los controles en la parte superior para:</p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>Filtrar por mes específico.</li>
                  <li>Buscar por nombre de comercio.</li>
                  <li>Filtrar por un monto mínimo final.</li>
                </ul>
                
                <p><strong>Acciones:</strong></p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li><strong>Editar:</strong> Modifica los detalles de una compra existente.</li>
                  <li><strong>Eliminar:</strong> Borra una compra permanentemente (requiere confirmación).</li>
                  <li><strong>Exportar:</strong> Descarga todas tus transacciones (filtradas o no) en un archivo CSV.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger className="text-lg hover:no-underline">
                <div className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-primary" />
                  Comercios Adheridos
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-base pl-2">
                <p><strong>¿Para qué sirve la sección de Comercios?</strong></p>
                <p>Esta sección te permite gestionar la lista de comercios donde has realizado compras o que planeas visitar. Los comercios se añaden automáticamente cuando registras una compra con un nuevo nombre/ubicación de comercio, o puedes añadirlos manualmente aquí.</p>
                
                <p><strong>Añadir Nuevo Comercio Manualmente:</strong></p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>Usa el formulario para ingresar el nombre del comercio.</li>
                  <li>La ubicación es opcional pero ayuda a distinguir sucursales. Un comercio se considera único por la combinación de su nombre y ubicación.</li>
                </ul>

                <p><strong>Lista de Comercios:</strong></p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>Visualiza todos tus comercios guardados.</li>
                  <li>Utiliza el campo de búsqueda (<Search className="inline h-4 w-4" />) para encontrar comercios por nombre o ubicación.</li>
                  <li>La lista se pagina si tienes muchos comercios.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger className="text-lg hover:no-underline">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                   Configuración
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-base pl-2">
                <p><strong>Configuración del Beneficio:</strong></p>
                <p>Define los parámetros principales de tu beneficio gastronómico. Tus cambios se guardarán automáticamente.</p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li><strong>Beneficio Mensual Total ($):</strong> El monto máximo que cubre tu beneficio cada mes.</li>
                  <li><strong>Porcentaje de Descuento (%):</strong> El porcentaje que se descuenta del monto original de cada compra.</li>
                  <li><strong>Umbral de Alerta de Límite (%):</strong> Recibe una alerta cuando tus gastos superen este porcentaje de tu beneficio mensual.</li>
                </ul>

                <p><strong><BellRing className="inline h-5 w-5 text-blue-600" /> Recordatorio de Fin de Mes:</strong></p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>Activa/Desactiva el recordatorio para recibir una notificación si te queda saldo pendiente cerca de fin de mes.</li>
                  <li>Si está activo, puedes configurar cuántos días antes de que termine el mes quieres recibir el aviso (ej. 3 días antes).</li>
                </ul>
                
                <p><strong><UserCheck className="inline h-5 w-5 text-blue-600" /> Autenticación y Sincronización en la Nube:</strong></p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                    <li>Inicia sesión con tu cuenta de Google para habilitar la sincronización automática de tus datos con tu Google Drive.</li>
                    <li>Utiliza el botón "Sincronizar Ahora" para guardar tus cambios en Google Drive de inmediato.</li>
                    <li>Si no inicias sesión, tus datos se guardan únicamente en el navegador y dispositivo actual.</li>
                </ul>

                <p><strong><FileUp className="inline h-5 w-5 text-green-600" /> Backup Manual a Excel:</strong></p>
                <p>Guarda una copia de tus datos actuales en tu computadora:</p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li><strong>A Excel:</strong> Descarga un archivo Excel (.xlsx) con tus compras, comercios y configuración actual. Esto es útil para tener un respaldo local o para análisis externo.</li>
                </ul>

                <p><strong><FileDown className="inline h-5 w-5 text-red-600" /> Restaurar Datos desde Excel:</strong></p>
                <p className="font-semibold text-destructive-foreground bg-destructive/10 p-2 rounded-md border border-destructive/30">
                  ¡Atención! Restaurar datos desde un archivo Excel reemplazará TODA tu información actual (compras, comercios y configuración) con los datos del archivo. Este cambio se sincronizará con Google Drive si has iniciado sesión.
                </p>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-cloud-privacy">
              <AccordionTrigger className="text-lg hover:no-underline">
                <div className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-primary" />
                  Datos en la Nube y Privacidad
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-base pl-2">
                <p><strong>¿Cómo se guardan mis datos si inicio sesión?</strong></p>
                <p>
                  Si eliges iniciar sesión con tu cuenta de Google, tus datos de la aplicación (compras, comercios y configuración) se almacenan en un **único archivo JSON** (`ledesc_app_data.json`) dentro de una carpeta llamada **`Ledesc Sync`** en tu **Google Drive**. Esto permite las siguientes ventajas:
                </p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li><strong>Sincronización Automática:</strong> Cualquier cambio que hagas se guarda automáticamente en el archivo de tu Drive, permitiéndote acceder a tus datos actualizados desde cualquier dispositivo donde inicies sesión con la misma cuenta.</li>
                  <li><strong>Control Total:</strong> El archivo de datos te pertenece y reside en tu Google Drive. Tienes control total sobre él.</li>
                  <li><strong>Persistencia:</strong> Tus datos no se pierden si cambias de navegador o dispositivo.</li>
                </ul>
                <p>Si no inicias sesión, tus datos se guardan únicamente de forma local en el navegador que estés utilizando y no se sincronizarán.</p>

                <p><strong><Lock className="inline h-4 w-4 text-green-600 mr-1" />Seguridad y Permisos de Google Drive:</strong></p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>La aplicación solicita el permiso `drive.file`. Esto significa que la aplicación **solo puede acceder a los archivos que ella misma crea**.</li>
                  <li>{APP_NAME} **no tiene acceso** a ningún otro archivo o carpeta en tu Drive, solo a la carpeta `Ledesc Sync` y los archivos que ella misma crea y gestiona dentro de esa carpeta.</li>
                  <li>Tu contraseña de Google nunca es almacenada ni vista por {APP_NAME}. La autenticación se maneja de forma segura a través de los servicios de Google.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-install">
              <AccordionTrigger className="text-lg hover:no-underline">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  Instalar Aplicación en tu Móvil
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-base pl-2">
                <p>{APP_NAME} es una Aplicación Web Progresiva (PWA), lo que significa que puedes instalarla en tu dispositivo móvil para un acceso más rápido y una experiencia similar a una aplicación nativa.</p>
                
                <div>
                  <p><strong>En Android (usando Chrome):</strong></p>
                  <ol className="list-decimal list-inside pl-4 space-y-1 mt-1">
                    <li>Abre {APP_NAME} en tu navegador Chrome.</li>
                    <li>Toca el menú de Chrome (usualmente tres puntos verticales <MoreVertical className="inline h-4 w-4" /> en la esquina superior derecha).</li>
                    <li>Busca y selecciona la opción "Instalar aplicación" o "Agregar a la pantalla principal" <PlusSquare className="inline h-4 w-4" />.</li>
                    <li>Sigue las instrucciones en pantalla para confirmar.</li>
                    <li>El ícono de {APP_NAME} aparecerá en tu pantalla de inicio o en tu cajón de aplicaciones.</li>
                  </ol>
                </div>

                <div>
                  <p><strong>En iOS (iPhone/iPad, usando Safari):</strong></p>
                  <ol className="list-decimal list-inside pl-4 space-y-1 mt-1">
                    <li>Abre {APP_NAME} en tu navegador Safari.</li>
                    <li>Toca el ícono de Compartir (un cuadrado con una flecha hacia arriba <Share className="inline h-4 w-4" /> en la barra de navegación inferior o superior).</li>
                    <li>Desplázate hacia abajo en el menú de compartir y busca la opción "Agregar a inicio" <PlusSquare className="inline h-4 w-4" />.</li>
                    <li>Confirma el nombre de la aplicación (debería ser {APP_NAME}) y toca "Agregar".</li>
                    <li>El ícono de {APP_NAME} aparecerá en tu pantalla de inicio.</li>
                  </ol>
                </div>
                <p>Una vez instalada, podrás iniciar {APP_NAME} directamente desde su ícono como cualquier otra aplicación.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger className="text-lg hover:no-underline">
                <div className="flex items-center gap-2">
                  <MailQuestion className="h-5 w-5 text-primary" />
                  Contacto
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-base pl-2">
                <p><strong>¿Cómo puedo contactarlos?</strong></p>
                <p>Utiliza la sección "Contacto" en el menú lateral para enviarnos tus mensajes. Queremos saber tu opinión para mejorar {APP_NAME}.</p>
                
                <p><strong>Formulario de Contacto:</strong></p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li><strong>Motivo del Contacto:</strong> Selecciona una de las opciones (<MessageSquare className="inline h-4 w-4" /> Sugerencias, <HelpCircle className="inline h-4 w-4" /> Reportar Errores, <HelpCircle className="inline h-4 w-4" /> Consultas Generales).</li>
                  <li><strong>Tu Email de Contacto:</strong> Ingresa tu dirección de correo electrónico para que podamos responderte si es necesario.</li>
                  <li><strong>Mensaje:</strong> Escribe aquí tu mensaje detallado.</li>
                </ul>
                 <p>Haz clic en "<Send className="inline h-4 w-4" /> Enviar Mensaje" una vez que hayas completado el formulario.</p>
                 <p>Aunque no podemos garantizar una respuesta inmediata a todas las consultas, leeremos todos los mensajes y los tendremos en cuenta.</p>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
