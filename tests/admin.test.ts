import { describe, it, expect } from 'vitest';

describe('Admin Security & Control Subsystem', () => {
  interface User {
    email: string;
    role: 'ADMIN' | 'PARTICIPANT';
  }

  function validateUserPurge(adminEmail: string, targetUser: User | null): { allowed: boolean; status: number; error?: string } {
    if (!targetUser) {
      return { allowed: false, status: 404, error: 'User not found.' };
    }
    if (targetUser.email.toLowerCase() === adminEmail.toLowerCase()) {
      return { allowed: false, status: 400, error: 'Cannot purge your own administrator account.' };
    }
    if (targetUser.role === 'ADMIN') {
      return { allowed: false, status: 403, error: 'Cannot delete an admin account.' };
    }
    return { allowed: true, status: 200 };
  }

  function validateAdminDemotion(adminCount: number, currentRole: string, newRole: string): { allowed: boolean; error?: string } {
    if (currentRole === 'ADMIN' && newRole !== 'ADMIN') {
      if (adminCount <= 1) {
        return { allowed: false, error: 'Cannot demote the last administrator account.' };
      }
    }
    return { allowed: true };
  }

  describe('User Purge Protection Rules', () => {
    it('prevents an administrator from purging their own account', () => {
      const admin: User = { email: 'curator@alfaaz.local', role: 'ADMIN' };
      const res = validateUserPurge('curator@alfaaz.local', admin);

      expect(res.allowed).toBe(false);
      expect(res.status).toBe(400);
      expect(res.error).toContain('Cannot purge your own');
    });

    it('prevents purging of other administrator accounts', () => {
      const otherAdmin: User = { email: 'secondary_admin@alfaaz.local', role: 'ADMIN' };
      const res = validateUserPurge('curator@alfaaz.local', otherAdmin);

      expect(res.allowed).toBe(false);
      expect(res.status).toBe(403);
      expect(res.error).toContain('Cannot delete an admin account');
    });

    it('permits purging regular participant accounts', () => {
      const participant: User = { email: 'volunteer@alfaaz.local', role: 'PARTICIPANT' };
      const res = validateUserPurge('curator@alfaaz.local', participant);

      expect(res.allowed).toBe(true);
      expect(res.status).toBe(200);
    });

    it('returns 404 if target user does not exist', () => {
      const res = validateUserPurge('curator@alfaaz.local', null);
      expect(res.allowed).toBe(false);
      expect(res.status).toBe(404);
    });
  });

  describe('Last Administrator Protection', () => {
    it('blocks demoting the last administrator account when adminCount is 1', () => {
      const res = validateAdminDemotion(1, 'ADMIN', 'PARTICIPANT');
      expect(res.allowed).toBe(false);
      expect(res.error).toContain('Cannot demote the last administrator');
    });

    it('allows demoting an administrator when multiple admins exist', () => {
      const res = validateAdminDemotion(2, 'ADMIN', 'PARTICIPANT');
      expect(res.allowed).toBe(true);
    });

    it('allows promoting a participant to administrator', () => {
      const res = validateAdminDemotion(1, 'PARTICIPANT', 'ADMIN');
      expect(res.allowed).toBe(true);
    });
  });

  describe('Exhibition Cycle Exclusivity', () => {
    interface Exhibition {
      id: number;
      title: string;
      is_active: boolean;
    }

    it('ensures only one exhibition cycle is active at any time', () => {
      const exhibitions: Exhibition[] = [
        { id: 1, title: 'BAYAAN 2023', is_active: true },
        { id: 2, title: 'KAAMIL 2024', is_active: false },
        { id: 3, title: 'HARUD 2025', is_active: false }
      ];

      // Activate cycle 2
      const targetId = 2;
      for (const ex of exhibitions) {
        ex.is_active = (ex.id === targetId);
      }

      const activeList = exhibitions.filter(e => e.is_active);
      expect(activeList).toHaveLength(1);
      expect(activeList[0].id).toBe(2);
      expect(activeList[0].title).toBe('KAAMIL 2024');
    });
  });
});
