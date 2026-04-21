// Export pubblico del modulo clients.
// Chi vuole usare il modulo importa DA QUI, non dai file interni.

// Tools AI
export {
  searchClientsTool,
  findOrCreateClientTool,
  CLIENT_TOOLS,
} from './server/client.tools'

// Validations
export {
  createClientSchema,
  updateClientSchema,
  type CreateClientInput,
  type UpdateClientInput,
} from './validations/client'

// Hooks
export {
  useClients,
  useClient,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
} from './hooks/use-clients'

// Components
export { ClientsPageContent } from './components/clients-page-content'
export { ClientDialog } from './components/client-dialog'
