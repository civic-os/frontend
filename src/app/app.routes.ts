import { Routes } from '@angular/router';
import { ListPage } from './pages/list/list.page';
import { DetailPage } from './pages/detail/detail.page';
import { CreatePage } from './pages/create/create.page';
import { EditPage } from './pages/edit/edit.page';
import { PermissionsPage } from './pages/permissions/permissions.page';
import { EntityManagementPage } from './pages/entity-management/entity-management.page';
import { PropertyManagementPage } from './pages/property-management/property-management.page';

export const routes: Routes = [
    {
        path: 'permissions',
        component: PermissionsPage
    },
    {
        path: 'entity-management',
        component: EntityManagementPage
    },
    {
        path: 'property-management',
        component: PropertyManagementPage
    },
    {
        path: 'view/:entityKey',
        component: ListPage
    },
    {
        path: 'view/:entityKey/:entityId',
        component: DetailPage
    },
    {
        path: 'create/:entityKey',
        component: CreatePage
    },
    {
        path: 'edit/:entityKey/:entityId',
        component: EditPage
    },
];
