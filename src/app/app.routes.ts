import { Routes } from '@angular/router';
import { ListPage } from './pages/list/list.page';
import { DetailPage } from './pages/detail/detail.page';

export const routes: Routes = [
    {
        path: 'view/:entityKey',
        component: ListPage
    },
    {
        path: 'view/:entityKey/:entityId',
        component: DetailPage
    },
];
