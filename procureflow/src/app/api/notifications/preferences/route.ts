import { successResponse } from '@/lib/api-response'
import { withApiHandler } from '@/lib/api-handler'
import {
  getUserPreferences,
  updateUserPreferences,
  updatePreferencesSchema,
} from '@/modules/core/notifications'

export const GET = withApiHandler(
  {
    auth: true,
    errorMessage: 'Errore nel recupero preferenze notifiche',
  },
  async ({ user }) => {
    const prefs = await getUserPreferences(user.id)
    return successResponse(prefs)
  },
)

export const PATCH = withApiHandler(
  {
    auth: true,
    bodySchema: updatePreferencesSchema,
    errorMessage: "Errore nell'aggiornamento preferenze notifiche",
  },
  async ({ body, user }) => {
    const updated = await updateUserPreferences(user.id, body)
    return successResponse(updated)
  },
)
