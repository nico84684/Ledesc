import { SettingsForm } from '@/components/settings/SettingsForm';
import { Metadata } from 'next';
import { APP_NAME } from '@/config/constants';

export const metadata: Metadata = {
  title: `Configuración - ${APP_NAME}`,
  description: 'Ajusta los parámetros de tu beneficio gastronómico.',
};

export default function SettingsPage() {
  return (
    // Container removed from here, it's now inside the SettingsForm component
    // to provide more granular control over layout sections.
    <SettingsForm />
  );
}
