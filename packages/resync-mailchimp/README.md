## RESYNC-MAILCHIMP 

Integração retroativa dos contatos dos ativistas para o Mailchimp. 
Atualmente quando o ativista interage em  alguma widget de ação (donation, pressure,form_entries) ele é automaticamente sincronizado à base do mailchimp com as correspondentes TAGs e MERGE FIELDS. Contudo, as vezes, essa sincronização falha.

Assim, foi desenvolvida essa integração para realizar a ressincronização dos contatos dos ativistas de uma dertermida widget ou comunidade através de uma ação.  

### Hasura Action 

- Action definition

type Query {
  resync (
    iscommunity: Boolean
    id: Int!
  ): Output
}

- Output

type Output {
  status : String
}

### Add Resync Mailchimp

O objetivo da ação é mandar os dados da widget ou comunidade, e assim, atráves de server express  é executada a lógica para buscar as informações dos ativistas no banco de dados e armazenar numa fila para serem ressinncronizados no mailchimp.


### Worker

Finalmente o woker realiza a execução dos jobs da fila para a sincronização além de atualizar as informações do processo no banco de dados. 

### Commandos

### Instalar 

`pnpm i`

### Run

`pnpm --filter resync-mailchimp run dev`

`pnpm --filter resync-mailchimp run dev-worker`
### Testes

`pnpm --filter resync-mailchimp run test`

### Links úteis

https://hasura.io/docs/latest/graphql/core/actions/index.html
https://mailchimp.com/developer/marketing/guides/organize-contacts-with-tags/
