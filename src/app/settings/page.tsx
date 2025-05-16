import { SettingsForm } from '@/components/settings/SettingsForm';
import { Metadata } from 'next';
import { APP_NAME } from '@/config/constants';

export const metadata: Metadata = {
  title: `Configuración - ${APP_NAME}`,
  description: 'Ajusta los parámetros de tu beneficio gastronómico.',
};

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8">
      <SettingsForm />
    </div>
  );
}
