import { Routes } from '@angular/router';
import { ListPage } from './pages/list/list.page';
import { DetailPage } from './pages/detail/detail.page';
import { CreatePage } from './pages/create/create.page';

export const routes: Routes = [
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
];
