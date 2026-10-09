# Frontend conventions
- Define visual roles in global HSL tokens and expose them through Tailwind; feature pages must not hardcode colors, so branding remains consistent.
- Use the shared ScriptCard and bento layout classes for catalog previews and marketplace results, so both storefronts retain consistent presentation.
- Keep marketplace visual changes separate from purchase, access, and licensing logic to preserve existing business rules.
- Keep decorative terminal code in a shared, aria-hidden, pointer-inert component; never execute it or expose marketplace source code.
- Use the shared PageHeader for section introductions and shared UI primitives for controls; this keeps the premium presentation consistent without coupling it to business logic.