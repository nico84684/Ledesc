
import type { Metadata } from 'next';
import { APP_NAME } from '@/config/constants';
import { ContactFormComponent } from '@/components/contact/ContactForm'; 
import { MailQuestion } from 'lucide-react';

export const metadata: Metadata = {
  title: `Contacto - ${APP_NAME}`,
  description: 'Envíanos tus sugerencias, reporta errores o haz tus consultas.',
};

export default function ContactPage() {
  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <header className="mb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground flex items-center justify-center gap-3">
          <MailQuestion className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
          Contáctanos
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          ¿Tienes alguna sugerencia, encontraste un error o tienes alguna consulta? ¡Háznoslo saber!
        </p>
      </header>
      <ContactFormComponent />
    </div>
  );
}
