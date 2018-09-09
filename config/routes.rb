Rails.application.routes.draw do
  resources :topics do
 # #34
  resources :posts, except: [:index]
   end
  get 'Topics', to: 'topics#show'
  get 'about' => 'welcome#about'
  get 'login', to: redirect('/auth/google_oauth2'), as: 'login'
  get 'logout', to: 'sessions#destroy', as: 'logout'
  get 'auth/:provider/callback', to: 'sessions#create'
  get 'auth/failure', to: redirect('/')
  get 'home', to: 'home#show'
  get 'welcome/index'
  get 'me', to: 'me#show', as: 'me'


  root to: "home#show"

end
