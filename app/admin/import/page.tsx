import { redirect } from 'next/navigation'

export default function LegacyImportRedirect() {
  redirect('/admin?tab=import')
}
