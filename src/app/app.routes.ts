import { Routes } from '@angular/router';
import { ViewPage } from './pages/view/view.page';
import { DetailPage } from './pages/detail/detail.page';

export const routes: Routes = [
    {
        path: 'view/:entityKey',
        component: ViewPage
    },
    {
        path: 'view/:entityKey/:entityId',
        component: DetailPage
    },
];
