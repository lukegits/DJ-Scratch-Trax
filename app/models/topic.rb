class Topic < ApplicationRecord
has_many :posts, dependent: :destroy
 def self.search(search)
 where("title LIKE ?", "%#{search}%")
end
end
