import React, { useState } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import ManagementHeader from '@/components/ManagementHeader';
import { Checkbox } from '@/components/ui/checkbox';

export default function Users({ users, shops, roles }: { users: any[], shops: any[], roles: any[] }) {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editItem, setEditItem] = useState<any | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
        name: '',
        email: '',
        password: '',
        role: '',
        shop_ids: [] as string[]
    });

    const openAdd = () => {
        reset();
        setIsAddOpen(true);
    };

    const openEdit = (item: any) => {
        setData({
            name: item.name,
            email: item.email,
            password: '',
            role: item.roles && item.roles.length > 0 ? item.roles[0].name : '',
            shop_ids: item.shops ? item.shops.map((s: any) => s.id.toString()) : []
        });
        setEditItem(item);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editItem) {
            put(`/management/users/${editItem.id}`, {
                preserveScroll: true,
                onSuccess: () => {
                    setEditItem(null);
                    reset();
                    clearErrors();
                }
            });
        } else {
            post('/management/users', {
                preserveScroll: true,
                onSuccess: () => {
                    setIsAddOpen(false);
                    reset();
                    clearErrors();
                }
            });
        }
    };

    const handleDelete = () => {
        if (deleteId) {
            router.delete(`/management/users/${deleteId}`, {
                preserveScroll: true,
                onSuccess: () => setDeleteId(null)
            });
        }
    };

    return (
        <AppLayout title="Users">
            <Head title="Manage Users" />

            <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-20">
                <ManagementHeader>
                    <Button onClick={openAdd} className="uppercase tracking-widest text-[10px] font-bold px-4 py-2 h-9">
                        + New User
                    </Button>
                </ManagementHeader>

                <div className="flex flex-col">
                    {users.length === 0 ? (
                        <EmptyState
                            title="No Users Found"
                            description="You haven't added any users yet."
                        />
                    ) : (
                        users.map((item) => (
                            <div key={item.id} className="py-4 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center px-4 -mx-4 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                <div>
                                    <span className="text-base font-bold text-black dark:text-white block">{item.name}</span>
                                    <span className="text-xs text-zinc-400 mt-1 block">{item.email}</span>
                                    {item.shops && item.shops.length > 0 && (
                                        <span className="text-xs text-blue-500 mt-1 block">
                                            Shops: {item.shops.map((s: any) => s.name).join(', ')}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-lg">
                                        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">
                                            {item.roles && item.roles.length > 0 ? item.roles[0].name : 'NO ROLE'}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => openEdit(item)} className="text-[10px] font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 bg-transparent px-2 py-1 rounded hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-black dark:hover:text-white transition-colors">EDIT</button>
                                        <button onClick={() => setDeleteId(item.id)} className="text-[10px] font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 bg-transparent px-2 py-1 rounded hover:border-red-200 dark:hover:border-red-900/50 hover:text-red-600 dark:hover:text-red-500 transition-colors">DELETE</button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <Dialog open={isAddOpen || !!editItem} onOpenChange={(open) => { if (!open) { setIsAddOpen(false); setEditItem(null); reset(); clearErrors(); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editItem ? 'Edit User' : 'New User'}</DialogTitle>
                        <DialogDescription>{editItem ? 'Update user details and permissions.' : 'Add a new user to your system.'}</DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-6 mt-4" autoComplete="off">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <Label>Full Name</Label>
                                <Input value={data.name} onChange={e => { setData('name', e.target.value); clearErrors('name'); }} placeholder="e.g. John Doe" />
                                {errors.name && <span className="text-red-500 text-xs">{errors.name}</span>}
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label>Email Address</Label>
                                <Input type="email" value={data.email} onChange={e => { setData('email', e.target.value); clearErrors('email'); }} placeholder="e.g. john@example.com" autoComplete="off" />
                                {errors.email && <span className="text-red-500 text-xs">{errors.email}</span>}
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label>Password {editItem && '(Leave blank to keep current)'}</Label>
                                <Input type="password" value={data.password} onChange={e => { setData('password', e.target.value); clearErrors('password'); }} placeholder="Min. 8 characters" autoComplete="new-password" />
                                {errors.password && <span className="text-red-500 text-xs">{errors.password}</span>}
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label>Assign to Shops</Label>
                                <div className="grid grid-cols-2 gap-3 mt-1 p-3 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-900/50">
                                    {shops.map(shop => (
                                        <div key={shop.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`shop-${shop.id}`}
                                                checked={data.shop_ids.includes(shop.id.toString())}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setData('shop_ids', [...data.shop_ids, shop.id.toString()]);
                                                    } else {
                                                        setData('shop_ids', data.shop_ids.filter((id: string) => id !== shop.id.toString()));
                                                    }
                                                    clearErrors('shop_ids');
                                                }}
                                            />
                                            <label
                                                htmlFor={`shop-${shop.id}`}
                                                className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                {shop.name}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                                {errors.shop_ids && <span className="text-red-500 text-xs">{errors.shop_ids}</span>}
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label>Role</Label>
                                <Select value={data.role} onValueChange={(val) => { setData('role', val as string); clearErrors('role'); }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a role">
                                            {data.role ? roles.find(r => r.name === data.role)?.name.toUpperCase() : null}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map(role => (
                                            <SelectItem key={role.id} value={role.name}>{role.name.toUpperCase()}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.role && <span className="text-red-500 text-xs">{errors.role}</span>}
                            </div>
                        </div>

                        <Button type="submit" disabled={processing} className="w-full mt-2 font-bold tracking-widest uppercase">
                            {processing ? "Saving..." : (editItem ? "Save Changes" : "Create User")}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete User?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this user? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="destructive" onClick={handleDelete} className="w-full">
                            YES, DELETE USER
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
