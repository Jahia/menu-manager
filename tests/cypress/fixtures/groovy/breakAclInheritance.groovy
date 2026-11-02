// Breaks the ACL inheritance of NODE_PATH in the edit workspace and grants READ_ROLE to READ_USER there,
// so only that user (and root) can read the node once it is published.
import org.jahia.services.content.JCRCallback
import org.jahia.services.content.JCRSessionWrapper
import org.jahia.services.content.JCRTemplate

JCRTemplate.getInstance().doExecuteWithSystemSession(new JCRCallback<Object>() {
    Object doInJCR(JCRSessionWrapper session) {
        def node = session.getNode("NODE_PATH")
        node.setAclInheritanceBreak(true)
        node.grantRoles("u:READ_USER", ["READ_ROLE"] as Set)
        session.save()
        return null
    }
})
