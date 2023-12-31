import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'propSplit',
  standalone: true,
  
})
export class PropToTitlePipe implements PipeTransform {

  transform(value: string): string {
    return value.split('_').join(' ');
  }

}
