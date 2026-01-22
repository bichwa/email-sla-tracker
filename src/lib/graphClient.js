import { Client } from '@microsoft/microsoft-graph-client'

export class GraphClient {
    constructor(accessToken) {
        this.client = Client.init({
            authProvider: (done) => {
                done(null, accessToken)
            },
        })
    }

    /**
     * Fetch user's profile information
     */
    async getUserProfile() {
        try {
            const user = await this.client.api('/me').get()
            return user
        } catch (error) {
            console.error('Error fetching user profile:', error)
            throw error
        }
    }

    /**
     * Fetch emails from a mailbox
     * @param {string} mailbox - User email or 'me' for current user
     * @param {object} options - Query options
     */
    async getEmails(mailbox = 'me', options = {}) {
        try {
            const {
                top = 50,
                skip = 0,
                filter = null,
                orderBy = 'receivedDateTime desc',
                select = 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,hasAttachments,conversationId,internetMessageId',
            } = options

            let request = this.client
                .api(`/users/${mailbox}/messages`)
                .select(select)
                .orderby(orderBy)
                .top(top)
                .skip(skip)

            if (filter) {
                request = request.filter(filter)
            }

            const response = await request.get()
            return response.value || []
        } catch (error) {
            console.error('Error fetching emails:', error)
            throw error
        }
    }

    /**
     * Get sent emails to check for responses
     */
    async getSentEmails(mailbox = 'me', options = {}) {
        try {
            const {
                top = 50,
                filter = null,
                orderBy = 'sentDateTime desc',
            } = options

            let request = this.client
                .api(`/users/${mailbox}/sentItems`)
                .select('id,subject,toRecipients,sentDateTime,conversationId,internetMessageId')
                .orderby(orderBy)
                .top(top)

            if (filter) {
                request = request.filter(filter)
            }

            const response = await request.get()
            return response.value || []
        } catch (error) {
            console.error('Error fetching sent emails:', error)
            throw error
        }
    }

    /**
     * Get specific email by ID
     */
    async getEmailById(messageId, mailbox = 'me') {
        try {
            const email = await this.client
                .api(`/users/${mailbox}/messages/${messageId}`)
                .get()
            return email
        } catch (error) {
            console.error('Error fetching email by ID:', error)
            throw error
        }
    }

    /**
     * Search for emails in conversation
     */
    async getConversationEmails(conversationId, mailbox = 'me') {
        try {
            const emails = await this.client
                .api(`/users/${mailbox}/messages`)
                .filter(`conversationId eq '${conversationId}'`)
                .orderby('receivedDateTime asc')
                .get()
            return emails.value || []
        } catch (error) {
            console.error('Error fetching conversation emails:', error)
            throw error
        }
    }

    /**
     * List all users in the organization (for admin)
     */
    async listUsers() {
        try {
            const users = await this.client
                .api('/users')
                .select('mail,displayName,givenName,surname,userPrincipalName')
                .filter('accountEnabled eq true')
                .get()
            return users.value || []
        } catch (error) {
            console.error('Error listing users:', error)
            throw error
        }
    }
}

export default GraphClient
